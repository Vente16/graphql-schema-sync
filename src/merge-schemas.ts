import type {
  IntrospectionField,
  IntrospectionInputValue,
  IntrospectionType
} from 'graphql';
import {
  getFieldKey,
  getInputFields,
  getObjectFields,
  isInternalTypeName,
  isNamedType,
  isRequiredType,
  makeNullableSdl,
  typeRefToSdl
} from './introspection-utils.js';
import type {
  CompatArg,
  CompatField,
  CompatSchema,
  CompatType,
  EnvironmentSchema,
  FieldAvailability
} from './types.js';

function buildAvailability(
  presentIn: string[],
  allEnvironments: string[]
): FieldAvailability {
  const environments = [...presentIn];
  const missingIn = allEnvironments.filter(env => !presentIn.includes(env));
  return { environments, missingIn };
}

function pickBaseDefinition<T>(
  definitions: Map<string, T>,
  baseEnvironment: string,
  environmentOrder: string[]
): T | undefined {
  if (definitions.has(baseEnvironment)) {
    return definitions.get(baseEnvironment);
  }

  for (const env of environmentOrder) {
    const definition = definitions.get(env);
    if (definition) {
      return definition;
    }
  }

  return undefined;
}

function mergeArgs(
  parentType: string,
  fieldName: string,
  schemas: EnvironmentSchema[],
  baseEnvironment: string,
  allEnvironments: string[]
): CompatArg[] {
  const argPresence = new Map<
    string,
    Map<string, { definition: IntrospectionInputValue }>
  >();

  for (const schema of schemas) {
    const type = schema.introspection.__schema.types.find(
      t => isNamedType(t) && t.name === parentType
    );

    if (!type || (type.kind !== 'OBJECT' && type.kind !== 'INTERFACE')) {
      continue;
    }

    const field = getObjectFields(type).find(f => f.name === fieldName);
    if (!field?.args?.length) {
      continue;
    }

    for (const arg of field.args) {
      if (!argPresence.has(arg.name)) {
        argPresence.set(arg.name, new Map());
      }
      argPresence
        .get(arg.name)!
        .set(schema.environment.name, { definition: arg });
    }
  }

  const environmentOrder = schemas.map(s => s.environment.name);

  return [...argPresence.entries()]
    .map(([argName, envMap]) => {
      const presentIn = [...envMap.keys()];
      const availability = buildAvailability(presentIn, allEnvironments);
      const baseArg = pickBaseDefinition(
        envMap,
        baseEnvironment,
        environmentOrder
      )?.definition;

      if (!baseArg) {
        return null;
      }

      const originalTypeSdl = typeRefToSdl(baseArg.type);
      const isRequiredInAll =
        presentIn.length === allEnvironments.length &&
        isRequiredType(baseArg.type);
      const typeSdl = isRequiredInAll
        ? originalTypeSdl
        : makeNullableSdl(originalTypeSdl);

      const compatArg: CompatArg = {
        name: argName,
        description: baseArg.description,
        typeSdl,
        originalTypeSdl,
        defaultValue: baseArg.defaultValue,
        availability,
        isRequiredInAll
      };

      return compatArg;
    })
    .filter((arg): arg is CompatArg => arg !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function mergeObjectFields(
  typeName: string,
  schemas: EnvironmentSchema[],
  baseEnvironment: string,
  allEnvironments: string[]
): CompatField[] {
  const fieldPresence = new Map<
    string,
    Map<string, { definition: IntrospectionField }>
  >();

  for (const schema of schemas) {
    const type = schema.introspection.__schema.types.find(
      t => isNamedType(t) && t.name === typeName
    );

    if (!type || (type.kind !== 'OBJECT' && type.kind !== 'INTERFACE')) {
      continue;
    }

    for (const field of getObjectFields(type)) {
      if (!fieldPresence.has(field.name)) {
        fieldPresence.set(field.name, new Map());
      }
      fieldPresence
        .get(field.name)!
        .set(schema.environment.name, { definition: field });
    }
  }

  const environmentOrder = schemas.map(s => s.environment.name);

  return [...fieldPresence.entries()]
    .map(([fieldName, envMap]) => {
      const presentIn = [...envMap.keys()];
      const availability = buildAvailability(presentIn, allEnvironments);
      const baseField = pickBaseDefinition(
        envMap,
        baseEnvironment,
        environmentOrder
      )?.definition;

      if (!baseField) {
        return null;
      }

      const originalTypeSdl = typeRefToSdl(baseField.type);
      const isRequiredInAll =
        presentIn.length === allEnvironments.length &&
        isRequiredType(baseField.type);
      const typeSdl = isRequiredInAll
        ? originalTypeSdl
        : makeNullableSdl(originalTypeSdl);

      const compatField: CompatField = {
        name: fieldName,
        description: baseField.description,
        typeSdl,
        originalTypeSdl,
        args: mergeArgs(
          typeName,
          fieldName,
          schemas,
          baseEnvironment,
          allEnvironments
        ),
        availability,
        isRequiredInAll
      };

      return compatField;
    })
    .filter((field): field is CompatField => field !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function mergeInputFields(
  typeName: string,
  schemas: EnvironmentSchema[],
  baseEnvironment: string,
  allEnvironments: string[]
): CompatField[] {
  const fieldPresence = new Map<
    string,
    Map<string, { definition: IntrospectionInputValue }>
  >();

  for (const schema of schemas) {
    const type = schema.introspection.__schema.types.find(
      t => isNamedType(t) && t.name === typeName && t.kind === 'INPUT_OBJECT'
    );

    if (!type || type.kind !== 'INPUT_OBJECT') {
      continue;
    }

    for (const field of getInputFields(type)) {
      if (!fieldPresence.has(field.name)) {
        fieldPresence.set(field.name, new Map());
      }
      fieldPresence
        .get(field.name)!
        .set(schema.environment.name, { definition: field });
    }
  }

  const environmentOrder = schemas.map(s => s.environment.name);

  return [...fieldPresence.entries()]
    .map(([fieldName, envMap]) => {
      const presentIn = [...envMap.keys()];
      const availability = buildAvailability(presentIn, allEnvironments);
      const baseField = pickBaseDefinition(
        envMap,
        baseEnvironment,
        environmentOrder
      )?.definition;

      if (!baseField) {
        return null;
      }

      const originalTypeSdl = typeRefToSdl(baseField.type);
      const isRequiredInAll =
        presentIn.length === allEnvironments.length &&
        isRequiredType(baseField.type);
      const typeSdl = isRequiredInAll
        ? originalTypeSdl
        : makeNullableSdl(originalTypeSdl);

      const compatField: CompatField = {
        name: fieldName,
        description: baseField.description,
        typeSdl,
        originalTypeSdl,
        args: [],
        defaultValue: baseField.defaultValue,
        availability,
        isRequiredInAll
      };

      return compatField;
    })
    .filter((field): field is CompatField => field !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function mergeEnumValues(
  typeName: string,
  schemas: EnvironmentSchema[],
  baseEnvironment: string,
  allEnvironments: string[]
): CompatType['enumValues'] {
  const valuePresence = new Map<
    string,
    Map<string, { description?: string | null }>
  >();

  for (const schema of schemas) {
    const type = schema.introspection.__schema.types.find(
      t => isNamedType(t) && t.name === typeName && t.kind === 'ENUM'
    );

    if (!type || type.kind !== 'ENUM') {
      continue;
    }

    for (const value of type.enumValues ?? []) {
      if (!valuePresence.has(value.name)) {
        valuePresence.set(value.name, new Map());
      }
      valuePresence.get(value.name)!.set(schema.environment.name, {
        description: value.description
      });
    }
  }

  const environmentOrder = schemas.map(s => s.environment.name);

  return [...valuePresence.entries()]
    .map(([valueName, envMap]) => {
      const presentIn = [...envMap.keys()];
      const availability = buildAvailability(presentIn, allEnvironments);
      const baseValue = pickBaseDefinition(
        envMap,
        baseEnvironment,
        environmentOrder
      );

      return {
        name: valueName,
        description: baseValue?.description,
        availability
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function collectTypeNames(schemas: EnvironmentSchema[]): Set<string> {
  const names = new Set<string>();

  for (const schema of schemas) {
    for (const type of schema.introspection.__schema.types) {
      if (isNamedType(type) && !isInternalTypeName(type.name)) {
        names.add(type.name);
      }
    }
  }

  return names;
}

function getTypeFromSchema(
  schema: EnvironmentSchema,
  typeName: string
): IntrospectionType | undefined {
  return schema.introspection.__schema.types.find(
    t => isNamedType(t) && t.name === typeName
  );
}

function getTypeKind(
  schemas: EnvironmentSchema[],
  typeName: string,
  baseEnvironment: string
): CompatType['kind'] | null {
  const baseSchema =
    schemas.find(s => s.environment.name === baseEnvironment) ?? schemas[0];
  const baseType = getTypeFromSchema(baseSchema, typeName);

  if (baseType && isNamedType(baseType)) {
    if (
      baseType.kind === 'OBJECT' ||
      baseType.kind === 'INTERFACE' ||
      baseType.kind === 'INPUT_OBJECT' ||
      baseType.kind === 'ENUM' ||
      baseType.kind === 'UNION' ||
      baseType.kind === 'SCALAR'
    ) {
      return baseType.kind;
    }
  }

  for (const schema of schemas) {
    const type = getTypeFromSchema(schema, typeName);
    if (
      type &&
      isNamedType(type) &&
      (type.kind === 'OBJECT' ||
        type.kind === 'INTERFACE' ||
        type.kind === 'INPUT_OBJECT' ||
        type.kind === 'ENUM' ||
        type.kind === 'UNION' ||
        type.kind === 'SCALAR')
    ) {
      return type.kind;
    }
  }

  return null;
}

export function mergeSchemas(
  schemas: EnvironmentSchema[],
  baseEnvironment: string
): CompatSchema {
  if (schemas.length === 0) {
    throw new Error('At least one environment schema is required');
  }

  const allEnvironments = schemas.map(s => s.environment.name);
  const typeNames = [...collectTypeNames(schemas)].sort((a, b) =>
    a.localeCompare(b)
  );
  const types: CompatType[] = [];

  for (const typeName of typeNames) {
    const kind = getTypeKind(schemas, typeName, baseEnvironment);
    if (!kind) {
      continue;
    }

    const baseSchema =
      schemas.find(s => s.environment.name === baseEnvironment) ?? schemas[0];
    const baseType = getTypeFromSchema(baseSchema, typeName);

    const compatType: CompatType = {
      kind,
      name: typeName,
      description:
        baseType && 'description' in baseType ? baseType.description : undefined
    };

    if (kind === 'OBJECT' || kind === 'INTERFACE') {
      compatType.fields = mergeObjectFields(
        typeName,
        schemas,
        baseEnvironment,
        allEnvironments
      );

      if (
        baseType &&
        (baseType.kind === 'OBJECT' || baseType.kind === 'INTERFACE')
      ) {
        compatType.interfaces = baseType.interfaces?.map(i => i.name) ?? [];
      }
    }

    if (kind === 'INPUT_OBJECT') {
      compatType.fields = mergeInputFields(
        typeName,
        schemas,
        baseEnvironment,
        allEnvironments
      );
    }

    if (kind === 'ENUM') {
      compatType.enumValues = mergeEnumValues(
        typeName,
        schemas,
        baseEnvironment,
        allEnvironments
      );
    }

    if (kind === 'UNION' && baseType?.kind === 'UNION') {
      compatType.possibleTypes = baseType.possibleTypes?.map(t => t.name) ?? [];
    }

    types.push(compatType);
  }

  return {
    types,
    environments: allEnvironments,
    baseEnvironment
  };
}

export function getSchemaDifferences(schema: CompatSchema) {
  const differences: Array<{
    type: string;
    field: string;
    availableIn: string[];
    missingIn: string[];
    madeOptional: boolean;
  }> = [];

  for (const type of schema.types) {
    if (type.fields) {
      for (const field of type.fields) {
        if (field.availability.missingIn.length > 0) {
          differences.push({
            type: type.name,
            field: getFieldKey(type.name, field.name),
            availableIn: field.availability.environments,
            missingIn: field.availability.missingIn,
            madeOptional: !field.isRequiredInAll
          });
        }

        for (const arg of field.args) {
          if (arg.availability.missingIn.length > 0) {
            differences.push({
              type: type.name,
              field: `${getFieldKey(type.name, field.name)}(${arg.name})`,
              availableIn: arg.availability.environments,
              missingIn: arg.availability.missingIn,
              madeOptional: !arg.isRequiredInAll
            });
          }
        }
      }
    }

    if (type.enumValues) {
      for (const value of type.enumValues) {
        if (value.availability.missingIn.length > 0) {
          differences.push({
            type: type.name,
            field: `${type.name}.${value.name}`,
            availableIn: value.availability.environments,
            missingIn: value.availability.missingIn,
            madeOptional: false
          });
        }
      }
    }
  }

  return differences;
}
