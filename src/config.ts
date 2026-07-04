import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import type { ResolvedEnvironment, SchemaSyncConfig } from './types.js';

const environmentValueSchema = z.union([
  z.string().url(),
  z.object({
    url: z.string().url(),
    priority: z.number().optional(),
    headers: z.record(z.string(), z.string()).optional()
  })
]);

const configSchema = z.object({
  environments: z
    .record(z.string(), environmentValueSchema)
    .refine(
      envs => Object.keys(envs).length > 0,
      'At least one environment is required'
    ),
  baseEnvironment: z.string(),
  output: z.object({
    compatSchema: z.string(),
    types: z.string(),
    report: z.string(),
    defaults: z.string()
  }),
  codegen: z
    .object({
      documents: z.union([z.string(), z.array(z.string())]).optional(),
      plugins: z.array(z.string()).optional(),
      config: z.record(z.string(), z.unknown()).optional()
    })
    .optional(),
  headers: z.record(z.string(), z.string()).optional()
});

export async function loadConfig(
  configPath: string
): Promise<SchemaSyncConfig> {
  const absolutePath = resolve(configPath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Config file not found: ${absolutePath}`);
  }

  const module = await import(pathToFileURL(absolutePath).href);
  const rawConfig = module.default ?? module;

  const parsed = configSchema.safeParse(rawConfig);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(i => `${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid graphql-schema-sync config:\n${issues}`);
  }

  const config = parsed.data;

  if (!(config.baseEnvironment in config.environments)) {
    throw new Error(
      `baseEnvironment "${config.baseEnvironment}" is not defined in environments`
    );
  }

  return config;
}

export function resolveEnvironments(
  config: SchemaSyncConfig
): ResolvedEnvironment[] {
  const globalHeaders = config.headers ?? {};

  return Object.entries(config.environments)
    .map(([name, value], index) => {
      if (typeof value === 'string') {
        return {
          name,
          url: value,
          priority: index + 1,
          headers: { ...globalHeaders }
        };
      }

      return {
        name,
        url: value.url,
        priority: value.priority ?? index + 1,
        headers: { ...globalHeaders, ...value.headers }
      };
    })
    .sort((a, b) => a.priority - b.priority);
}
