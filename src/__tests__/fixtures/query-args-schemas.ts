import type { IntrospectionQuery } from 'graphql';

function createQueryDataIntrospection(
  args: Array<{
    name: string;
    type:
      | { kind: 'SCALAR'; name: string }
      | { kind: 'NON_NULL'; ofType: { kind: 'SCALAR'; name: string } };
  }>
): IntrospectionQuery {
  return {
    __schema: {
      queryType: { kind: 'OBJECT', name: 'Query' },
      mutationType: null,
      subscriptionType: null,
      types: [
        {
          kind: 'OBJECT',
          name: 'Query',
          description: null,
          fields: [
            {
              name: 'getQueryData',
              description: null,
              args: args.map(arg => ({
                name: arg.name,
                description: null,
                type: arg.type,
                defaultValue: null
              })),
              type: { kind: 'SCALAR', name: 'String' },
              isDeprecated: false,
              deprecationReason: null
            }
          ],
          interfaces: []
        },
        { kind: 'SCALAR', name: 'String', description: null },
        { kind: 'SCALAR', name: 'Int', description: null }
      ],
      directives: []
    }
  };
}

const intArg = {
  kind: 'NON_NULL' as const,
  ofType: { kind: 'SCALAR' as const, name: 'Int' }
};
const stringArg = {
  kind: 'NON_NULL' as const,
  ofType: { kind: 'SCALAR' as const, name: 'String' }
};

export const developQueryDataSchema = createQueryDataIntrospection([
  { name: 'age', type: intArg },
  { name: 'name', type: stringArg }
]);

export const stagingQueryDataSchema = createQueryDataIntrospection([
  { name: 'age', type: intArg }
]);
