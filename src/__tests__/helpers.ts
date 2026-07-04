import type { EnvironmentSchema } from '../types.js';

export function createEnvironmentSchema(
  name: string,
  introspection: EnvironmentSchema['introspection'],
  options: {
    priority?: number;
    url?: string;
    headers?: Record<string, string>;
  } = {}
): EnvironmentSchema {
  return {
    environment: {
      name,
      url: options.url ?? `https://${name}.example.com/graphql`,
      priority: options.priority ?? 1,
      headers: options.headers ?? {}
    },
    introspection
  };
}
