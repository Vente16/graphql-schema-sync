import { extractNamedType } from './adapt-document.js';
import type { CompatSchema } from './types.js';

const ROOT_OPERATION_TYPES = ['Query', 'Mutation', 'Subscription'] as const;

function graphqlTypeToTsDefault(typeSdl: string): string {
  const isRequired = typeSdl.endsWith('!');
  const normalized = typeSdl.replace(/!$/, '');

  if (normalized === 'String' || normalized === 'ID') {
    return "''";
  }

  if (normalized === 'Int' || normalized === 'Float') {
    return isRequired ? '0' : 'null';
  }

  if (normalized === 'Boolean') {
    return 'false';
  }

  if (normalized.startsWith('[')) {
    return '[]';
  }

  return 'null';
}

function toPascalCase(name: string): string {
  return name;
}

function toCamelCase(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function generateResponseNormalizers(schema: CompatSchema): string[] {
  const lines: string[] = [];
  const objectTypes = schema.types.filter(
    type => type.kind === 'OBJECT' && type.fields && type.fields.length > 0
  );

  for (const type of objectTypes) {
    if (
      ROOT_OPERATION_TYPES.includes(
        type.name as (typeof ROOT_OPERATION_TYPES)[number]
      )
    ) {
      continue;
    }

    const typeName = toPascalCase(type.name);
    const defaultsName = `${typeName}Defaults`;
    const normalizerName = `normalize${typeName}`;

    const defaultEntries = (type.fields ?? [])
      .filter(field => field.availability.missingIn.length > 0)
      .map(field => {
        const value = graphqlTypeToTsDefault(field.typeSdl);
        return `  ${field.name}: ${value},`;
      });

    if (defaultEntries.length === 0) {
      continue;
    }

    lines.push(`export const ${defaultsName} = {`);
    lines.push(...defaultEntries);
    lines.push('} as const;', '');
    lines.push(
      `export function ${normalizerName}<T extends Record<string, unknown>>(value?: T | null) {`
    );
    lines.push('  return {');
    lines.push('    ...(value ?? {}),');

    for (const field of type.fields ?? []) {
      if (field.availability.missingIn.length > 0) {
        const accessor = toCamelCase(field.name);
        lines.push(
          `    ${field.name}: value?.${accessor} ?? ${defaultsName}.${field.name},`
        );
      }
    }

    lines.push('  };');
    lines.push('}', '');
  }

  return lines;
}

function generateOperationHelpers(schema: CompatSchema): string[] {
  const lines: string[] = [];
  const operationAvailabilityEntries: string[] = [];
  const operationArgAvailabilityEntries: string[] = [];

  for (const rootType of ROOT_OPERATION_TYPES) {
    const type = schema.types.find(entry => entry.name === rootType);
    if (!type?.fields?.length) {
      continue;
    }

    for (const field of type.fields) {
      const operationKey = `${rootType}.${field.name}`;
      const envList = field.availability.environments
        .map(env => `'${env}'`)
        .join(', ');
      operationAvailabilityEntries.push(`  '${operationKey}': [${envList}],`);

      if (field.args.length === 0) {
        continue;
      }

      const argEntries = field.args.map(arg => {
        const argEnvList = arg.availability.environments
          .map(env => `'${env}'`)
          .join(', ');
        return `    ${arg.name}: [${argEnvList}],`;
      });

      operationArgAvailabilityEntries.push(`  '${operationKey}': {`);
      operationArgAvailabilityEntries.push(...argEntries);
      operationArgAvailabilityEntries.push('  },');
    }
  }

  if (operationAvailabilityEntries.length === 0) {
    return lines;
  }

  const environmentUnion = schema.environments
    .map(env => `'${env}'`)
    .join(' | ');

  lines.push(`export type GraphqlEnvironment = ${environmentUnion};`, '');
  lines.push(
    `export type RootOperationType = ${ROOT_OPERATION_TYPES.map(type => `'${type}'`).join(' | ')};`,
    ''
  );
  lines.push('export const operationAvailability = {');
  lines.push(...operationAvailabilityEntries);
  lines.push('} as const;', '');

  if (operationArgAvailabilityEntries.length > 0) {
    lines.push('export const operationArgAvailability = {');
    lines.push(...operationArgAvailabilityEntries);
    lines.push('} as const;', '');
  }

  lines.push(
    'export function isOperationAvailable(',
    '  environment: GraphqlEnvironment,',
    '  parentType: RootOperationType,',
    '  fieldName: string,',
    '): boolean {',
    '  const key = `${parentType}.${fieldName}` as keyof typeof operationAvailability;',
    '  const environments = operationAvailability[key];',
    '  if (!environments) {',
    '    return true;',
    '  }',
    '  return (environments as readonly string[]).includes(environment);',
    '}',
    '',
    'export function filterOperationArgs(',
    '  environment: GraphqlEnvironment,',
    '  parentType: RootOperationType,',
    '  fieldName: string,',
    '  args: Record<string, unknown>,',
    '): Record<string, unknown> {',
    '  const key = `${parentType}.${fieldName}` as keyof typeof operationArgAvailability;',
    '  const argMap = operationArgAvailability[key];',
    '  if (!argMap) {',
    '    return args;',
    '  }',
    '',
    '  return Object.fromEntries(',
    '    Object.entries(args).filter(([argName]) => {',
    '      const availableIn = argMap[argName as keyof typeof argMap];',
    '      if (!availableIn) {',
    '        return true;',
    '      }',
    '      return (availableIn as readonly string[]).includes(environment);',
    '    }),',
    '  );',
    '}',
    ''
  );

  return lines;
}

function generateTypeMetadata(
  schema: CompatSchema,
  hasOperationArgAvailability: boolean
): string[] {
  const typeFieldAvailabilityEntries: string[] = [];
  const fieldReturnTypesEntries: string[] = [];
  const objectTypeNames: string[] = [];

  for (const type of schema.types) {
    if (type.kind !== 'OBJECT' || !type.fields?.length) {
      continue;
    }

    objectTypeNames.push(type.name);

    const fieldAvailabilityEntries: string[] = [];
    const returnTypeEntries: string[] = [];

    for (const field of type.fields) {
      const envList = field.availability.environments
        .map(env => `'${env}'`)
        .join(', ');
      fieldAvailabilityEntries.push(`    ${field.name}: [${envList}],`);

      const namedType = extractNamedType(field.typeSdl);
      if (namedType) {
        returnTypeEntries.push(`    ${field.name}: '${namedType}',`);
      }
    }

    if (fieldAvailabilityEntries.length > 0) {
      typeFieldAvailabilityEntries.push(`  ${type.name}: {`);
      typeFieldAvailabilityEntries.push(...fieldAvailabilityEntries);
      typeFieldAvailabilityEntries.push('  },');
    }

    if (returnTypeEntries.length > 0) {
      fieldReturnTypesEntries.push(`  ${type.name}: {`);
      fieldReturnTypesEntries.push(...returnTypeEntries);
      fieldReturnTypesEntries.push('  },');
    }
  }

  if (typeFieldAvailabilityEntries.length === 0) {
    return [];
  }

  const argAvailabilityRef = hasOperationArgAvailability
    ? 'operationArgAvailability'
    : 'operationArgAvailability: {}';

  const lines: string[] = [
    "import { createDocumentAdapter } from 'graphql-schema-env-sync/runtime';",
    '',
    'export const typeFieldAvailability = {',
    ...typeFieldAvailabilityEntries,
    '} as const;',
    '',
    'export const fieldReturnTypes = {',
    ...fieldReturnTypesEntries,
    '} as const;',
    '',
    'export const objectTypes = [',
    ...objectTypeNames.map(name => `  '${name}',`),
    '] as const;',
    '',
    'export function isFieldAvailable(',
    '  environment: GraphqlEnvironment,',
    '  parentType: string,',
    '  fieldName: string,',
    '): boolean {',
    "  if (fieldName === '__typename') {",
    '    return true;',
    '  }',
    '',
    '  const typeFields = typeFieldAvailability[parentType as keyof typeof typeFieldAvailability];',
    '  if (!typeFields) {',
    '    return true;',
    '  }',
    '',
    '  const environments = typeFields[fieldName as keyof typeof typeFields];',
    '  if (!environments) {',
    '    return true;',
    '  }',
    '',
    '  return (environments as readonly string[]).includes(environment);',
    '}',
    '',
    'const adaptDocument = createDocumentAdapter({',
    '  operationAvailability,',
    `  ${argAvailabilityRef},`,
    '  typeFieldAvailability,',
    '  fieldReturnTypes,',
    '  objectTypes,',
    '});',
    '',
    'export function adaptDocumentForEnvironment(',
    "  document: import('graphql').DocumentNode,",
    '  environment: GraphqlEnvironment,',
    ') {',
    '  return adaptDocument(document, environment);',
    '}',
    '',
    'export const environmentCompatHelpers = {',
    '  adaptDocumentForEnvironment,',
    '  filterOperationArgs,',
    '  typeFieldAvailability,',
    '} as const;',
    ''
  ];

  return lines;
}

export function generateDefaults(schema: CompatSchema): string {
  const lines: string[] = [
    '// Generated by graphql-schema-env-sync',
    `// Base environment: ${schema.baseEnvironment}`,
    ''
  ];

  const operationHelpers = generateOperationHelpers(schema);
  const responseNormalizers = generateResponseNormalizers(schema);
  const hasOperationArgAvailability = operationHelpers.some(line =>
    line.includes('export const operationArgAvailability')
  );

  if (operationHelpers.length > 0) {
    lines.push('// --- Operation availability (requests) ---', '');
    lines.push(...operationHelpers);
  }

  if (operationHelpers.length > 0) {
    const typeMetadata = generateTypeMetadata(
      schema,
      hasOperationArgAvailability
    );
    if (typeMetadata.length > 0) {
      lines.push('// --- Runtime document adaptation ---', '');
      lines.push(...typeMetadata);
    }
  }

  if (responseNormalizers.length > 0) {
    lines.push('// --- Response normalizers ---', '');
    lines.push(...responseNormalizers);
  }

  if (operationHelpers.length === 0 && responseNormalizers.length === 0) {
    lines.push('// No environment-specific compatibility helpers were needed.');
    lines.push('');
  }

  return lines.join('\n');
}
