import {
  Kind,
  type DocumentNode,
  type FieldNode,
  type FragmentDefinitionNode,
  type OperationDefinitionNode,
  type SelectionNode,
  type SelectionSetNode
} from 'graphql';

function getResponseKey(field: FieldNode): string {
  return field.alias?.value ?? field.name.value;
}

function getOperationDefinition(
  document: DocumentNode,
  operationName?: string
): OperationDefinitionNode | undefined {
  const operations = document.definitions.filter(
    (definition): definition is OperationDefinitionNode =>
      definition.kind === Kind.OPERATION_DEFINITION
  );

  if (operations.length === 0) {
    return undefined;
  }

  if (!operationName) {
    return operations[0];
  }

  return (
    operations.find(operation => operation.name?.value === operationName) ??
    operations[0]
  );
}

function buildFragmentMap(
  document: DocumentNode
): Map<string, FragmentDefinitionNode> {
  const fragments = new Map<string, FragmentDefinitionNode>();

  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(definition.name.value, definition);
    }
  }

  return fragments;
}

function expandSelection(
  selection: SelectionNode,
  fragments: Map<string, FragmentDefinitionNode>,
  visitedFragments = new Set<string>()
): SelectionNode[] {
  if (selection.kind === Kind.FIELD) {
    return [selection];
  }

  if (selection.kind === Kind.INLINE_FRAGMENT) {
    return selection.selectionSet.selections.flatMap(nested =>
      expandSelection(nested, fragments, visitedFragments)
    );
  }

  if (selection.kind === Kind.FRAGMENT_SPREAD) {
    if (visitedFragments.has(selection.name.value)) {
      return [];
    }

    const fragment = fragments.get(selection.name.value);
    if (!fragment) {
      return [];
    }

    const nextVisited = new Set(visitedFragments);
    nextVisited.add(selection.name.value);

    return fragment.selectionSet.selections.flatMap(nested =>
      expandSelection(nested, fragments, nextVisited)
    );
  }

  return [selection];
}

function expandSelectionSet(
  selectionSet: SelectionSetNode,
  fragments: Map<string, FragmentDefinitionNode>
): SelectionSetNode {
  const selections = selectionSet.selections.flatMap(selection =>
    expandSelection(selection, fragments)
  );

  return {
    ...selectionSet,
    selections
  };
}

function setMissingField(
  record: Record<string, unknown>,
  key: string,
  value: unknown
): void {
  if (!(key in record) || record[key] === undefined) {
    record[key] = value;
  }
}

function padSelectionSet(
  selectionSet: SelectionSetNode,
  value: unknown,
  fragments: Map<string, FragmentDefinitionNode>
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => padSelectionSet(selectionSet, item, fragments));
  }

  if (typeof value !== 'object') {
    return value;
  }

  const record = { ...(value as Record<string, unknown>) };
  const expandedSelectionSet = expandSelectionSet(selectionSet, fragments);

  for (const selection of expandedSelectionSet.selections) {
    padSelection(record, selection, fragments);
  }

  return record;
}

function padSelection(
  record: Record<string, unknown>,
  selection: SelectionNode,
  fragments: Map<string, FragmentDefinitionNode>
): void {
  if (selection.kind === Kind.FIELD) {
    const key = getResponseKey(selection);

    if (!selection.selectionSet) {
      setMissingField(record, key, null);
      return;
    }

    if (!(key in record) || record[key] === undefined) {
      record[key] = null;
      return;
    }

    record[key] = padSelectionSet(
      selection.selectionSet,
      record[key],
      fragments
    );
    return;
  }

  if (selection.kind === Kind.INLINE_FRAGMENT) {
    const expanded = expandSelectionSet(selection.selectionSet, fragments);
    for (const nested of expanded.selections) {
      padSelection(record, nested, fragments);
    }
    return;
  }

  if (selection.kind === Kind.FRAGMENT_SPREAD) {
    const expanded = expandSelection(selection, fragments);
    for (const nested of expanded) {
      padSelection(record, nested, fragments);
    }
  }
}

/**
 * Adds null for object fields that exist in richer environments but not the
 * active one. Covers fragment spreads codegen keeps in separate documents.
 */
export function padWithTypeAvailability(
  data: unknown,
  environment: string,
  typeFieldAvailability: Record<string, Record<string, readonly string[]>>
): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item =>
      padWithTypeAvailability(item, environment, typeFieldAvailability)
    );
  }

  if (typeof data !== 'object') {
    return data;
  }

  const record = { ...(data as Record<string, unknown>) };
  const typename = record.__typename;

  if (typeof typename === 'string' && typeFieldAvailability[typename]) {
    for (const [fieldName, environments] of Object.entries(
      typeFieldAvailability[typename]
    )) {
      if (!environments.includes(environment)) {
        setMissingField(record, fieldName, null);
      }
    }
  }

  for (const [key, value] of Object.entries(record)) {
    if (value !== null && typeof value === 'object') {
      record[key] = padWithTypeAvailability(
        value,
        environment,
        typeFieldAvailability
      );
    }
  }

  return record;
}

/**
 * Ensures response data includes every field from the query document.
 * Apollo's cache writes against the original query shape; when staging
 * omits fields like `language`, padding prevents cache write errors.
 */
export function padResponseForDocument(
  document: DocumentNode,
  data: unknown,
  operationName?: string
): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  const operation = getOperationDefinition(document, operationName);
  if (!operation?.selectionSet) {
    return data;
  }

  const fragments = buildFragmentMap(document);
  const record = { ...(data as Record<string, unknown>) };

  for (const selection of operation.selectionSet.selections) {
    padSelection(record, selection, fragments);
  }

  return record;
}

export function padOperationResponse(options: {
  document: DocumentNode;
  data: unknown;
  environment: string;
  operationName?: string;
  typeFieldAvailability?: Record<string, Record<string, readonly string[]>>;
}): Record<string, unknown> {
  let padded = padResponseForDocument(
    options.document,
    options.data,
    options.operationName
  );

  if (options.typeFieldAvailability) {
    padded = padWithTypeAvailability(
      padded,
      options.environment,
      options.typeFieldAvailability
    );
  }

  return padded as Record<string, unknown>;
}
