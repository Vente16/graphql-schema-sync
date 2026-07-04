import type { IntrospectionQuery } from 'graphql';

export function createStarshipIntrospection(
  fields: Array<{
    name: string;
    type:
      | { kind: 'SCALAR'; name: string }
      | { kind: 'NON_NULL'; ofType: { kind: 'SCALAR'; name: string } };
    args?: Array<{
      name: string;
      type:
        | { kind: 'ENUM'; name: string }
        | { kind: 'NON_NULL'; ofType: { kind: 'ENUM'; name: string } };
      defaultValue?: string | null;
    }>;
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
              name: 'starship',
              description: null,
              args: [],
              type: {
                kind: 'OBJECT',
                name: 'Starship'
              },
              isDeprecated: false,
              deprecationReason: null
            }
          ],
          interfaces: []
        },
        {
          kind: 'OBJECT',
          name: 'Starship',
          description: null,
          fields: fields.map(field => ({
            name: field.name,
            description: null,
            args: (field.args ?? []).map(arg => ({
              name: arg.name,
              description: null,
              type: arg.type,
              defaultValue: arg.defaultValue ?? null
            })),
            type: field.type,
            isDeprecated: false,
            deprecationReason: null
          })),
          interfaces: []
        },
        {
          kind: 'SCALAR',
          name: 'ID',
          description: null
        },
        {
          kind: 'SCALAR',
          name: 'String',
          description: null
        },
        {
          kind: 'SCALAR',
          name: 'Float',
          description: null
        },
        {
          kind: 'ENUM',
          name: 'LengthUnit',
          description: null,
          enumValues: [
            {
              name: 'METER',
              description: null,
              isDeprecated: false,
              deprecationReason: null
            }
          ]
        }
      ],
      directives: []
    }
  };
}

export const developStarshipSchema = createStarshipIntrospection([
  {
    name: 'id',
    type: { kind: 'NON_NULL', ofType: { kind: 'SCALAR', name: 'ID' } }
  },
  {
    name: 'name',
    type: { kind: 'NON_NULL', ofType: { kind: 'SCALAR', name: 'String' } }
  },
  {
    name: 'length',
    type: { kind: 'SCALAR', name: 'Float' },
    args: [
      {
        name: 'unit',
        type: { kind: 'ENUM', name: 'LengthUnit' },
        defaultValue: 'METER'
      }
    ]
  }
]);

export const stagingStarshipSchema = createStarshipIntrospection([
  {
    name: 'id',
    type: { kind: 'NON_NULL', ofType: { kind: 'SCALAR', name: 'ID' } }
  },
  {
    name: 'length',
    type: { kind: 'SCALAR', name: 'Float' },
    args: [
      {
        name: 'unit',
        type: { kind: 'ENUM', name: 'LengthUnit' },
        defaultValue: 'METER'
      }
    ]
  }
]);

export const productionStarshipSchema = createStarshipIntrospection([
  {
    name: 'id',
    type: { kind: 'NON_NULL', ofType: { kind: 'SCALAR', name: 'ID' } }
  }
]);
