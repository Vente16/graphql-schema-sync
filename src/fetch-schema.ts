import { getIntrospectionQuery, type IntrospectionQuery } from 'graphql';
import type { EnvironmentSchema, ResolvedEnvironment } from './types.js';

interface IntrospectionResponse {
  data?: IntrospectionQuery;
  errors?: Array<{ message: string }>;
}

export async function fetchSchema(
  environment: ResolvedEnvironment
): Promise<EnvironmentSchema> {
  let response: Response;

  try {
    response = await fetch(environment.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...environment.headers
      },
      body: JSON.stringify({
        query: getIntrospectionQuery({ descriptions: true })
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not connect to "${environment.name}" at ${environment.url}: ${message}. ` +
        'If you are running the local demo, start the servers first with "pnpm run demo:serve".'
    );
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch schema from "${environment.name}" (${environment.url}): ${response.status} ${response.statusText}`
    );
  }

  const payload = (await response.json()) as IntrospectionResponse;

  if (payload.errors?.length) {
    const messages = payload.errors.map(e => e.message).join('; ');
    throw new Error(
      `Introspection failed for "${environment.name}" (${environment.url}): ${messages}`
    );
  }

  if (!payload.data) {
    throw new Error(
      `Introspection returned no data for "${environment.name}" (${environment.url})`
    );
  }

  return {
    environment,
    introspection: payload.data
  };
}

export async function fetchAllSchemas(
  environments: ResolvedEnvironment[]
): Promise<EnvironmentSchema[]> {
  const results = await Promise.all(environments.map(env => fetchSchema(env)));
  return results;
}
