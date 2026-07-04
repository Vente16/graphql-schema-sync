import {
  ApolloClient,
  HttpLink,
  InMemoryCache,
  from
} from '@apollo/client/core';
import { parse } from 'graphql';
import { describe, expect, it, vi } from 'vitest';
import {
  createEnvironmentCompatLink,
  type EnvironmentCompatHelpers
} from '../apollo-link.js';
import { createDocumentAdapter } from '../adapt-document.js';

const moviesQuery = parse(`
  query GetMovies {
    getMovies {
      ...MovieFields
    }
  }

  fragment MovieFields on Movie {
    id
    title
    language
    posterUrl
    rating
    updatedAt
    description
    createdAt
    country
    cast
    __typename
  }
`);

const typeFieldAvailability = {
  Query: {
    getMovies: ['development', 'staging']
  },
  Movie: {
    id: ['development', 'staging'],
    title: ['development', 'staging'],
    releaseDate: ['development', 'staging'],
    duration: ['development', 'staging'],
    genre: ['development', 'staging'],
    director: ['development', 'staging'],
    language: ['development'],
    posterUrl: ['development'],
    rating: ['development'],
    updatedAt: ['development'],
    description: ['development'],
    createdAt: ['development'],
    country: ['development'],
    cast: ['development'],
    __typename: ['development', 'staging']
  }
};

const stagingPayload = {
  getMovies: [
    {
      id: '1',
      title: 'The Shawshank Redemption',
      genre: 'Drama',
      duration: 142,
      releaseDate: '1994-09-23',
      director: 'Frank Darabont',
      __typename: 'Movie'
    },
    {
      id: '2',
      title: 'Inception',
      genre: 'Sci-Fi',
      duration: 148,
      releaseDate: '2010-07-16',
      director: 'Christopher Nolan',
      __typename: 'Movie'
    }
  ]
};

const helpers: EnvironmentCompatHelpers = {
  adaptDocumentForEnvironment: createDocumentAdapter({
    operationAvailability: { 'Query.getMovies': ['development', 'staging'] },
    operationArgAvailability: {},
    typeFieldAvailability,
    fieldReturnTypes: { Query: { getMovies: 'Movie' } },
    objectTypes: ['Query', 'Movie']
  }),
  filterOperationArgs: (_environment, _parentType, _fieldName, args) => args,
  typeFieldAvailability
};

describe('createEnvironmentCompatLink integration', () => {
  it('pads fragment-only queries before Apollo writes to cache', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: stagingPayload
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const compatLink = createEnvironmentCompatLink({
      getEnvironment: () => 'staging',
      helpers
    });

    const client = new ApolloClient({
      link: from([
        compatLink,
        new HttpLink({ uri: 'https://example.test/graphql', fetch: fetchSpy })
      ]),
      cache: new InMemoryCache()
    });

    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const result = await client.query({
      query: moviesQuery,
      fetchPolicy: 'network-only'
    });

    expect(result.data.getMovies).toHaveLength(2);
    expect(result.data.getMovies[0].language).toBeNull();
    expect(result.data.getMovies[0].posterUrl).toBeNull();
    expect(result.data.getMovies[0].cast).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it('warns when typeFieldAvailability is missing', () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    createEnvironmentCompatLink({
      getEnvironment: () => 'staging',
      helpers: {
        adaptDocumentForEnvironment: helpers.adaptDocumentForEnvironment,
        filterOperationArgs: helpers.filterOperationArgs,
        typeFieldAvailability: undefined as unknown as Record<
          string,
          Record<string, readonly string[]>
        >
      }
    });

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
