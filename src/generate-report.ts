import { getSchemaDifferences } from './merge-schemas.js';
import type {
  CompatReport,
  CompatSchema,
  CompatType,
  EnvironmentMisses,
  EnvironmentOverview
} from './types.js';

const ROOT_OPERATION_TYPES = new Set(['Query', 'Mutation', 'Subscription']);

function isReportableType(type: CompatType): boolean {
  return type.kind !== 'SCALAR' && !ROOT_OPERATION_TYPES.has(type.name);
}

function getRootTypeFields(schema: CompatSchema, rootTypeName: string) {
  return schema.types.find(type => type.name === rootTypeName)?.fields ?? [];
}

function listFieldsPresentInEnvironment(
  fields: CompatSchema['types'][number]['fields'],
  environment: string
): string[] {
  return (fields ?? [])
    .filter(field => field.availability.environments.includes(environment))
    .map(field => field.name)
    .sort((a, b) => a.localeCompare(b));
}

function listFieldsMissingInEnvironment(
  fields: CompatSchema['types'][number]['fields'],
  environment: string
): string[] {
  return (fields ?? [])
    .filter(field => field.availability.missingIn.includes(environment))
    .map(field => field.name)
    .sort((a, b) => a.localeCompare(b));
}

function buildMissedTypes(schema: CompatSchema, environment: string) {
  const missedTypes: EnvironmentMisses['missedTypes'] = [];

  for (const type of schema.types) {
    if (!isReportableType(type)) {
      continue;
    }

    const missedFields = listFieldsMissingInEnvironment(
      type.fields,
      environment
    );
    const missedEnumValues = (type.enumValues ?? [])
      .filter(value => value.availability.missingIn.includes(environment))
      .map(value => value.name)
      .sort((a, b) => a.localeCompare(b));

    if (missedFields.length === 0 && missedEnumValues.length === 0) {
      continue;
    }

    missedTypes.push({
      name: type.name,
      kind: type.kind,
      ...(missedFields.length > 0 ? { missedFields } : {}),
      ...(missedEnumValues.length > 0 ? { missedEnumValues } : {})
    });
  }

  return missedTypes.sort((a, b) => a.name.localeCompare(b.name));
}

function buildEnvironmentOverview(
  schema: CompatSchema,
  environment: string
): Omit<EnvironmentOverview, 'role'> {
  return {
    types: schema.types
      .filter(isReportableType)
      .filter(type => {
        if (type.kind === 'UNION') {
          return true;
        }

        const hasField = type.fields?.some(field =>
          field.availability.environments.includes(environment)
        );
        const hasEnumValue = type.enumValues?.some(value =>
          value.availability.environments.includes(environment)
        );

        return Boolean(hasField || hasEnumValue);
      })
      .map(type => type.name)
      .sort((a, b) => a.localeCompare(b)),
    queries: listFieldsPresentInEnvironment(
      getRootTypeFields(schema, 'Query'),
      environment
    ),
    mutations: listFieldsPresentInEnvironment(
      getRootTypeFields(schema, 'Mutation'),
      environment
    ),
    subscriptions: listFieldsPresentInEnvironment(
      getRootTypeFields(schema, 'Subscription'),
      environment
    )
  };
}

function buildEnvironmentMisses(
  schema: CompatSchema,
  environment: string
): Omit<EnvironmentMisses, 'role'> {
  return {
    missedTypes: buildMissedTypes(schema, environment),
    missedQueries: listFieldsMissingInEnvironment(
      getRootTypeFields(schema, 'Query'),
      environment
    ),
    missedMutations: listFieldsMissingInEnvironment(
      getRootTypeFields(schema, 'Mutation'),
      environment
    ),
    missedSubscriptions: listFieldsMissingInEnvironment(
      getRootTypeFields(schema, 'Subscription'),
      environment
    )
  };
}

export function buildEnvironmentReport(schema: CompatSchema) {
  const byEnvironment: CompatReport['byEnvironment'] = {};

  for (const environment of schema.environments) {
    if (environment === schema.baseEnvironment) {
      byEnvironment[environment] = {
        ...buildEnvironmentOverview(schema, environment),
        role: 'base'
      };
    } else {
      byEnvironment[environment] = {
        ...buildEnvironmentMisses(schema, environment),
        role: 'target'
      };
    }
  }

  return byEnvironment;
}

export function generateCompatReport(schema: CompatSchema): CompatReport {
  const differences = getSchemaDifferences(schema);
  const typesWithDifferences = new Set(
    differences.map(difference => difference.type)
  );
  const byEnvironment = buildEnvironmentReport(schema);

  return {
    generatedAt: new Date().toISOString(),
    baseEnvironment: schema.baseEnvironment,
    environments: schema.environments,
    summary: {
      totalTypes: schema.types.filter(isReportableType).length,
      typesWithDifferences: typesWithDifferences.size,
      fieldsWithDifferences: differences.length
    },
    byEnvironment,
    differences
  };
}
