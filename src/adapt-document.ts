import {
  Kind,
  type DocumentNode,
  type FieldNode,
  type FragmentDefinitionNode,
  type OperationDefinitionNode,
  type SelectionNode,
  type SelectionSetNode
} from 'graphql';

export interface DocumentAdapterMetadata {
  operationAvailability: Record<string, readonly string[]>;
  operationArgAvailability: Record<string, Record<string, readonly string[]>>;
  typeFieldAvailability: Record<string, Record<string, readonly string[]>>;
  fieldReturnTypes: Record<string, Record<string, string>>;
  objectTypes: readonly string[];
}

export interface AdaptDocumentResult {
  document: DocumentNode;
  removedRootFields: string[];
}

type RootOperationType = 'Query' | 'Mutation' | 'Subscription';

const CACHE_IDENTITY_FIELDS = ['id', '__typename'] as const;

function createFieldNode(name: string): FieldNode {
  return {
    kind: Kind.FIELD,
    name: { kind: Kind.NAME, value: name }
  };
}

function createFallbackSelectionSet(
  metadata: DocumentAdapterMetadata,
  environment: string,
  parentType: string
): SelectionSetNode | null {
  const selections = CACHE_IDENTITY_FIELDS.filter(fieldName =>
    isFieldAvailable(metadata, environment, parentType, fieldName)
  ).map(createFieldNode);

  if (selections.length === 0) {
    return null;
  }

  return {
    kind: Kind.SELECTION_SET,
    selections
  };
}

function rootTypeForOperation(
  operation: OperationDefinitionNode['operation']
): RootOperationType {
  if (operation === 'mutation') {
    return 'Mutation';
  }
  if (operation === 'subscription') {
    return 'Subscription';
  }
  return 'Query';
}

function isFieldAvailable(
  metadata: DocumentAdapterMetadata,
  environment: string,
  parentType: string,
  fieldName: string
): boolean {
  if (fieldName === '__typename') {
    return true;
  }

  const typeFields = metadata.typeFieldAvailability[parentType];
  if (!typeFields) {
    return true;
  }

  const environments = typeFields[fieldName];
  if (!environments) {
    return true;
  }

  return environments.includes(environment);
}

function isArgAvailable(
  metadata: DocumentAdapterMetadata,
  environment: string,
  operationKey: string,
  argName: string
): boolean {
  const argMap = metadata.operationArgAvailability[operationKey];
  if (!argMap) {
    return true;
  }

  const environments = argMap[argName];
  if (!environments) {
    return true;
  }

  return environments.includes(environment);
}

function filterFieldArguments(
  metadata: DocumentAdapterMetadata,
  environment: string,
  operationKey: string,
  field: FieldNode
): FieldNode {
  if (!field.arguments?.length) {
    return field;
  }

  const filteredArguments = field.arguments.filter(arg =>
    isArgAvailable(metadata, environment, operationKey, arg.name.value)
  );

  if (filteredArguments.length === field.arguments.length) {
    return field;
  }

  return {
    ...field,
    arguments: filteredArguments
  };
}

function adaptSelectionSet(
  metadata: DocumentAdapterMetadata,
  environment: string,
  parentType: string,
  selectionSet: SelectionSetNode,
  fragments: Map<string, FragmentDefinitionNode>,
  isRootLevel: boolean
): SelectionSetNode | null {
  const adaptedSelections: SelectionNode[] = [];

  for (const selection of selectionSet.selections) {
    const adapted = adaptSelection(
      metadata,
      environment,
      parentType,
      selection,
      fragments,
      isRootLevel
    );

    if (adapted) {
      adaptedSelections.push(adapted);
    }
  }

  if (adaptedSelections.length === 0) {
    return createFallbackSelectionSet(metadata, environment, parentType);
  }

  return {
    ...selectionSet,
    selections: adaptedSelections
  };
}

function adaptSelection(
  metadata: DocumentAdapterMetadata,
  environment: string,
  parentType: string,
  selection: SelectionNode,
  fragments: Map<string, FragmentDefinitionNode>,
  isRootLevel: boolean
): SelectionNode | null {
  if (selection.kind === Kind.FIELD) {
    const fieldName = selection.name.value;

    if (!isFieldAvailable(metadata, environment, parentType, fieldName)) {
      return null;
    }

    const operationKey = `${parentType}.${fieldName}`;
    const field = isRootLevel
      ? filterFieldArguments(metadata, environment, operationKey, selection)
      : selection;

    const returnType = metadata.fieldReturnTypes[parentType]?.[fieldName];
    const canRecurse =
      returnType &&
      metadata.objectTypes.includes(returnType) &&
      field.selectionSet;

    if (!canRecurse) {
      return field;
    }

    const nestedSelectionSet = adaptSelectionSet(
      metadata,
      environment,
      returnType,
      field.selectionSet!,
      fragments,
      false
    );

    if (!nestedSelectionSet) {
      const fallbackSelectionSet = createFallbackSelectionSet(
        metadata,
        environment,
        returnType
      );

      if (!fallbackSelectionSet) {
        return null;
      }

      return {
        ...field,
        selectionSet: fallbackSelectionSet
      };
    }

    return {
      ...field,
      selectionSet: nestedSelectionSet
    };
  }

  if (selection.kind === Kind.INLINE_FRAGMENT) {
    const fragmentType = selection.typeCondition?.name.value ?? parentType;
    const nestedSelectionSet = adaptSelectionSet(
      metadata,
      environment,
      fragmentType,
      selection.selectionSet,
      fragments,
      false
    );

    if (!nestedSelectionSet) {
      return null;
    }

    return {
      ...selection,
      selectionSet: nestedSelectionSet
    };
  }

  if (selection.kind === Kind.FRAGMENT_SPREAD) {
    const fragment = fragments.get(selection.name.value);
    if (!fragment) {
      return selection;
    }

    const fragmentType = fragment.typeCondition.name.value;
    const nestedSelectionSet = adaptSelectionSet(
      metadata,
      environment,
      fragmentType,
      fragment.selectionSet,
      fragments,
      false
    );

    if (!nestedSelectionSet) {
      return null;
    }

    if (
      nestedSelectionSet.selections.length ===
      fragment.selectionSet.selections.length
    ) {
      return selection;
    }

    return {
      kind: Kind.INLINE_FRAGMENT,
      typeCondition: fragment.typeCondition,
      selectionSet: nestedSelectionSet
    };
  }

  return selection;
}

function adaptOperationDefinition(
  metadata: DocumentAdapterMetadata,
  environment: string,
  operation: OperationDefinitionNode,
  fragments: Map<string, FragmentDefinitionNode>
): { operation: OperationDefinitionNode; removedRootFields: string[] } {
  const rootType = rootTypeForOperation(operation.operation);
  const removedRootFields: string[] = [];

  if (!operation.selectionSet) {
    return { operation, removedRootFields };
  }

  const keptSelections: SelectionNode[] = [];

  for (const selection of operation.selectionSet.selections) {
    if (selection.kind !== Kind.FIELD) {
      const adapted = adaptSelection(
        metadata,
        environment,
        rootType,
        selection,
        fragments,
        true
      );
      if (adapted) {
        keptSelections.push(adapted);
      }
      continue;
    }

    const fieldName = selection.name.value;
    const operationKey = `${rootType}.${fieldName}`;
    const operationEnvironments = metadata.operationAvailability[operationKey];

    if (operationEnvironments && !operationEnvironments.includes(environment)) {
      removedRootFields.push(fieldName);
      continue;
    }

    if (!isFieldAvailable(metadata, environment, rootType, fieldName)) {
      removedRootFields.push(fieldName);
      continue;
    }

    const adapted = adaptSelection(
      metadata,
      environment,
      rootType,
      selection,
      fragments,
      true
    );

    if (adapted) {
      keptSelections.push(adapted);
    } else {
      removedRootFields.push(fieldName);
    }
  }

  return {
    operation: {
      ...operation,
      selectionSet: {
        ...operation.selectionSet,
        selections: keptSelections
      }
    },
    removedRootFields
  };
}

export function createDocumentAdapter(metadata: DocumentAdapterMetadata) {
  return function adaptDocumentForEnvironment(
    document: DocumentNode,
    environment: string
  ): AdaptDocumentResult {
    const fragments = new Map<string, FragmentDefinitionNode>();
    const removedRootFields: string[] = [];

    for (const definition of document.definitions) {
      if (definition.kind === Kind.FRAGMENT_DEFINITION) {
        fragments.set(definition.name.value, definition);
      }
    }

    const adaptedDefinitions = document.definitions.map(definition => {
      if (definition.kind !== Kind.OPERATION_DEFINITION) {
        return definition;
      }

      const result = adaptOperationDefinition(
        metadata,
        environment,
        definition,
        fragments
      );
      removedRootFields.push(...result.removedRootFields);
      return result.operation;
    });

    return {
      document: {
        ...document,
        definitions: adaptedDefinitions
      },
      removedRootFields
    };
  };
}

export function buildSkippedOperationData(
  removedRootFields: string[]
): Record<string, null> {
  return Object.fromEntries(removedRootFields.map(field => [field, null]));
}

export function extractNamedType(typeSdl: string): string | null {
  const match = typeSdl.match(/[A-Za-z_][A-Za-z0-9_]*/);
  return match?.[0] ?? null;
}

export function extractOperationContext(document: DocumentNode): {
  parentType: RootOperationType;
  fieldName: string;
  operationName?: string;
} | null {
  const operation = document.definitions.find(
    (definition): definition is OperationDefinitionNode =>
      definition.kind === Kind.OPERATION_DEFINITION
  );

  if (!operation?.selectionSet) {
    return null;
  }

  const rootField = operation.selectionSet.selections.find(
    (selection): selection is FieldNode => selection.kind === Kind.FIELD
  );

  if (!rootField) {
    return null;
  }

  return {
    parentType: rootTypeForOperation(operation.operation),
    fieldName: rootField.name.value,
    operationName: operation.name?.value
  };
}
