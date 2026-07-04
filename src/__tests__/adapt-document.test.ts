import { parse, print } from 'graphql';
import { describe, expect, it } from 'vitest';
import { createDocumentAdapter } from '../adapt-document.js';
import { mergeSchemas } from '../merge-schemas.js';
import { generateDefaults } from '../generate-defaults.js';
import { createEnvironmentSchema } from './helpers.js';
import {
  developUserSchema,
  stagingUserSchema
} from './fixtures/user-schemas.js';

describe('adaptDocument', () => {
  it('removes fields unavailable in the target environment', () => {
    const adapter = createDocumentAdapter({
      operationAvailability: {
        'Query.user': ['development', 'staging']
      },
      operationArgAvailability: {},
      typeFieldAvailability: {
        Query: { user: ['development', 'staging'] },
        User: {
          id: ['development', 'staging'],
          name: ['development', 'staging'],
          age: ['development'],
          hobbies: ['development'],
          occupation: ['development']
        }
      },
      fieldReturnTypes: {
        Query: { user: 'User' },
        User: {
          id: 'ID',
          name: 'String',
          age: 'Int',
          hobbies: 'String',
          occupation: 'String'
        }
      },
      objectTypes: ['Query', 'User']
    });

    const document = parse(`
      query GetUser {
        user {
          id
          name
          age
          hobbies
          occupation
        }
      }
    `);

    const { document: adapted } = adapter(document, 'staging');
    const printed = print(adapted);

    expect(printed).toContain('id');
    expect(printed).toContain('name');
    expect(printed).not.toContain('age');
    expect(printed).not.toContain('hobbies');
    expect(printed).not.toContain('occupation');
  });

  it('removes unavailable root operations', () => {
    const adapter = createDocumentAdapter({
      operationAvailability: {
        'Query.getMovies': ['development'],
        'Query.getMovie': ['development']
      },
      operationArgAvailability: {
        'Query.getMovie': { id: ['development'] }
      },
      typeFieldAvailability: {
        Query: {
          getMovies: ['development', 'staging'],
          getMovie: ['development']
        },
        Movie: {
          id: ['development', 'staging'],
          title: ['development', 'staging'],
          description: ['development']
        }
      },
      fieldReturnTypes: {
        Query: { getMovies: 'Movie', getMovie: 'Movie' },
        Movie: { id: 'ID', title: 'String', description: 'String' }
      },
      objectTypes: ['Query', 'Movie']
    });

    const document = parse(`
      query GetMovie($id: ID!) {
        getMovie(id: $id) {
          id
          title
          description
        }
      }
    `);

    const { document: adapted, removedRootFields } = adapter(
      document,
      'staging'
    );

    expect(removedRootFields).toContain('getMovie');
    expect(print(adapted)).not.toContain('getMovie');
  });

  it('keeps cache identity fields when all other nested fields are removed', () => {
    const adapter = createDocumentAdapter({
      operationAvailability: {
        'Query.getMovies': ['development', 'staging']
      },
      operationArgAvailability: {},
      typeFieldAvailability: {
        Query: { getMovies: ['development', 'staging'] },
        Movie: {
          id: ['development', 'staging'],
          title: ['development', 'staging'],
          description: ['development'],
          rating: ['development']
        }
      },
      fieldReturnTypes: {
        Query: { getMovies: 'Movie' },
        Movie: {
          id: 'ID',
          title: 'String',
          description: 'String',
          rating: 'Float'
        }
      },
      objectTypes: ['Query', 'Movie']
    });

    const document = parse(`
      query GetMovies {
        getMovies {
          description
          rating
        }
      }
    `);

    const { document: adapted } = adapter(document, 'staging');
    const printed = print(adapted);

    expect(printed).toContain('id');
    expect(printed).not.toContain('description');
    expect(printed).not.toContain('rating');
  });

  it('generates adaptDocumentForEnvironment in defaults output', () => {
    const merged = mergeSchemas(
      [
        createEnvironmentSchema('development', developUserSchema),
        createEnvironmentSchema('staging', stagingUserSchema)
      ],
      'development'
    );

    const defaults = generateDefaults(merged);

    expect(defaults).toContain('export const typeFieldAvailability');
    expect(defaults).toContain('export const fieldReturnTypes');
    expect(defaults).toContain('export function adaptDocumentForEnvironment');
    expect(defaults).toContain('export const environmentCompatHelpers');
    expect(defaults).not.toContain('padOperationResponse');
    expect(defaults).toContain("from 'graphql-schema-sync/runtime'");
  });
});
