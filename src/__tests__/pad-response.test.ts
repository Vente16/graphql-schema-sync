import { parse } from 'graphql';
import { describe, expect, it } from 'vitest';
import {
  padOperationResponse,
  padResponseForDocument,
  padWithTypeAvailability
} from '../pad-response.js';

describe('padResponseForDocument', () => {
  it('adds null for query fields missing from the response', () => {
    const document = parse(`
      query GetMovies {
        getMovies {
          id
          title
          language
        }
      }
    `);

    const data = {
      getMovies: [
        {
          id: '1',
          title: 'The Shawshank Redemption',
          __typename: 'Movie'
        }
      ]
    };

    const padded = padResponseForDocument(document, data) as {
      getMovies: Array<Record<string, unknown>>;
    };

    expect(padded.getMovies[0].language).toBeNull();
    expect(padded.getMovies[0].id).toBe('1');
  });

  it('pads fields referenced through fragment spreads', () => {
    const document = parse(`
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
      }
    `);

    const data = {
      getMovies: [
        {
          id: '1',
          title: 'The Shawshank Redemption',
          __typename: 'Movie'
        }
      ]
    };

    const padded = padResponseForDocument(document, data) as {
      getMovies: Array<Record<string, unknown>>;
    };

    expect(padded.getMovies[0].language).toBeNull();
    expect(padded.getMovies[0].posterUrl).toBeNull();
  });

  it('pads nested list items', () => {
    const document = parse(`
      query GetMovies {
        getMovies {
          id
          description
        }
      }
    `);

    const data = {
      getMovies: [
        { id: '1', __typename: 'Movie' },
        { id: '2', __typename: 'Movie' }
      ]
    };

    const padded = padResponseForDocument(document, data) as {
      getMovies: Array<{ id: string; description: null }>;
    };

    expect(padded.getMovies[0].description).toBeNull();
    expect(padded.getMovies[1].description).toBeNull();
  });
});

describe('padWithTypeAvailability', () => {
  it('adds null for fields unavailable in the active environment', () => {
    const data = {
      getMovies: [
        {
          id: '1',
          title: 'The Shawshank Redemption',
          __typename: 'Movie'
        }
      ]
    };

    const padded = padWithTypeAvailability(data, 'staging', {
      Movie: {
        id: ['development', 'staging'],
        title: ['development', 'staging'],
        language: ['development'],
        posterUrl: ['development']
      }
    }) as {
      getMovies: Array<Record<string, unknown>>;
    };

    expect(padded.getMovies[0].language).toBeNull();
    expect(padded.getMovies[0].posterUrl).toBeNull();
  });
});

describe('padOperationResponse', () => {
  it('combines query and type availability padding', () => {
    const document = parse(`
      query GetMovies {
        getMovies {
          id
          title
        }
      }
    `);

    const data = {
      getMovies: [
        {
          id: '1',
          title: 'The Shawshank Redemption',
          __typename: 'Movie'
        }
      ]
    };

    const padded = padOperationResponse({
      document,
      data,
      environment: 'staging',
      typeFieldAvailability: {
        Movie: {
          id: ['development', 'staging'],
          title: ['development', 'staging'],
          language: ['development'],
          posterUrl: ['development']
        }
      }
    }) as {
      getMovies: Array<Record<string, unknown>>;
    };

    expect(padded.getMovies[0].language).toBeNull();
    expect(padded.getMovies[0].posterUrl).toBeNull();
  });
});
