import { getIntrospectionQuery } from 'graphql';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAllSchemas, fetchSchema } from '../fetch-schema.js';
import { developStarshipSchema } from './fixtures/starship-schemas.js';

const environment = {
  name: 'develop',
  url: 'https://develop.example.com/graphql',
  priority: 1,
  headers: { Authorization: 'Bearer token' }
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchSchema', () => {
  it('fetches and returns introspection data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: developStarshipSchema })
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSchema(environment);

    expect(result.environment).toBe(environment);
    expect(result.introspection).toEqual(developStarshipSchema);
    expect(fetchMock).toHaveBeenCalledWith(
      environment.url,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          query: getIntrospectionQuery({ descriptions: true })
        })
      })
    );
  });

  it('throws when the HTTP response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })
    );

    await expect(fetchSchema(environment)).rejects.toThrow(
      'Failed to fetch schema from "develop"'
    );
  });

  it('throws when introspection returns GraphQL errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          errors: [{ message: 'Introspection is disabled' }]
        })
      })
    );

    await expect(fetchSchema(environment)).rejects.toThrow(
      'Introspection failed for "develop"'
    );
  });

  it('throws when introspection returns no data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({})
      })
    );

    await expect(fetchSchema(environment)).rejects.toThrow(
      'Introspection returned no data for "develop"'
    );
  });
});

describe('fetchAllSchemas', () => {
  it('fetches schemas for every environment', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: developStarshipSchema })
    });
    vi.stubGlobal('fetch', fetchMock);

    const environments = [
      environment,
      {
        ...environment,
        name: 'staging',
        url: 'https://staging.example.com/graphql'
      }
    ];

    const results = await fetchAllSchemas(environments);

    expect(results).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(results[0].environment.name).toBe('develop');
    expect(results[1].environment.name).toBe('staging');
  });
});
