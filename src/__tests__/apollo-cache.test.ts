import { InMemoryCache } from '@apollo/client/cache';
import { parse } from 'graphql';
import { describe, expect, it } from 'vitest';
import { padOperationResponse } from '../pad-response.js';

const moviesQuery = parse(`
  query GetMovies {
    getMovies {
      id
      title
      language
      posterUrl
      __typename
    }
  }
`);

const stagingResponse = {
  getMovies: [
    {
      id: '1',
      title: 'The Shawshank Redemption',
      __typename: 'Movie'
    }
  ]
};

const typeFieldAvailability = {
  Movie: {
    id: ['development', 'staging'],
    title: ['development', 'staging'],
    language: ['development'],
    posterUrl: ['development'],
    __typename: ['development', 'staging']
  }
};

describe('apollo cache integration', () => {
  it('reproduces missing-field cache writes without padding', () => {
    const cache = new InMemoryCache();

    cache.writeQuery({
      query: moviesQuery,
      data: stagingResponse
    });

    const read = cache.readQuery<{ getMovies: Array<Record<string, unknown>> }>(
      {
        query: moviesQuery
      }
    );

    expect(read?.getMovies[0].language).toBeUndefined();
  });

  it('writes staging data when missing fields are padded', () => {
    const cache = new InMemoryCache();
    const padded = padOperationResponse({
      document: moviesQuery,
      data: stagingResponse,
      environment: 'staging',
      typeFieldAvailability
    }) as {
      getMovies: Array<Record<string, unknown>>;
    };

    expect(() => {
      cache.writeQuery({
        query: moviesQuery,
        data: padded
      });
    }).not.toThrow();

    expect(padded.getMovies[0].language).toBeNull();
    expect(padded.getMovies[0].posterUrl).toBeNull();
  });
});
