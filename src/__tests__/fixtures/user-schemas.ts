import type { IntrospectionQuery } from 'graphql';

type ScalarFieldType =
  | { kind: 'SCALAR'; name: string }
  | { kind: 'NON_NULL'; ofType: { kind: 'SCALAR'; name: string } }
  | {
      kind: 'LIST';
      ofType: { kind: 'NON_NULL'; ofType: { kind: 'SCALAR'; name: string } };
    }
  | {
      kind: 'NON_NULL';
      ofType: {
        kind: 'LIST';
        ofType: { kind: 'NON_NULL'; ofType: { kind: 'SCALAR'; name: string } };
      };
    };

export function createUserIntrospection(
  fields: Array<{ name: string; type: ScalarFieldType }>
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
              name: 'user',
              description: null,
              args: [],
              type: { kind: 'OBJECT', name: 'User' },
              isDeprecated: false,
              deprecationReason: null
            }
          ],
          interfaces: []
        },
        {
          kind: 'OBJECT',
          name: 'User',
          description: null,
          fields: fields.map(field => ({
            name: field.name,
            description: null,
            args: [],
            type: field.type,
            isDeprecated: false,
            deprecationReason: null
          })),
          interfaces: []
        },
        { kind: 'SCALAR', name: 'String', description: null },
        { kind: 'SCALAR', name: 'Int', description: null }
      ],
      directives: []
    }
  };
}

const stringField = {
  kind: 'NON_NULL' as const,
  ofType: { kind: 'SCALAR' as const, name: 'String' }
};
const intField = {
  kind: 'NON_NULL' as const,
  ofType: { kind: 'SCALAR' as const, name: 'Int' }
};
const hobbiesField = {
  kind: 'NON_NULL' as const,
  ofType: {
    kind: 'LIST' as const,
    ofType: {
      kind: 'NON_NULL' as const,
      ofType: { kind: 'SCALAR' as const, name: 'String' }
    }
  }
};

export const developUserSchema = createUserIntrospection([
  { name: 'name', type: stringField },
  { name: 'age', type: intField },
  { name: 'hobbies', type: hobbiesField },
  { name: 'occupation', type: stringField }
]);

export const stagingUserSchema = createUserIntrospection([
  { name: 'name', type: stringField }
]);
