import { describe, expect, it } from 'vitest';
import { generateDefaults } from '../generate-defaults.js';
import { mergeSchemas } from '../merge-schemas.js';
import { createEnvironmentSchema } from './helpers.js';
import {
  developQueryDataSchema,
  stagingQueryDataSchema
} from './fixtures/query-args-schemas.js';
import {
  developStarshipSchema,
  productionStarshipSchema,
  stagingStarshipSchema
} from './fixtures/starship-schemas.js';
import {
  developUserSchema,
  stagingUserSchema
} from './fixtures/user-schemas.js';

describe('generateDefaults', () => {
  it('generates string, numeric, and list defaults for partially available fields', () => {
    const merged = mergeSchemas(
      [
        createEnvironmentSchema('develop', developUserSchema),
        createEnvironmentSchema('staging', stagingUserSchema)
      ],
      'develop'
    );

    const defaults = generateDefaults(merged);

    expect(defaults).toContain('export const UserDefaults');
    expect(defaults).toContain('age: null,');
    expect(defaults).toContain('hobbies: [],');
    expect(defaults).toContain("occupation: '',");
    expect(defaults).toContain('export function normalizeUser');
    expect(defaults).toContain('age: value?.age ?? UserDefaults.age');
    expect(defaults).toContain(
      'hobbies: value?.hobbies ?? UserDefaults.hobbies'
    );
    expect(defaults).toContain("'Query.user': ['develop', 'staging']");
  });

  it('generates operation arg availability and filter helpers', () => {
    const merged = mergeSchemas(
      [
        createEnvironmentSchema('develop', developQueryDataSchema),
        createEnvironmentSchema('staging', stagingQueryDataSchema)
      ],
      'develop'
    );

    const defaults = generateDefaults(merged);

    expect(defaults).toContain('export type GraphqlEnvironment');
    expect(defaults).toContain('export function isOperationAvailable');
    expect(defaults).toContain('export function filterOperationArgs');
    expect(defaults).toContain("'Query.getQueryData': ['develop', 'staging']");
    expect(defaults).toContain("'Query.getQueryData': {");
    expect(defaults).toContain("age: ['develop', 'staging'],");
    expect(defaults).toContain("name: ['develop'],");
  });

  it('includes operation availability even when response normalizers are not needed', () => {
    const merged = mergeSchemas(
      [createEnvironmentSchema('develop', developStarshipSchema)],
      'develop'
    );

    const defaults = generateDefaults(merged);

    expect(defaults).toContain("'Query.starship': ['develop']");
    expect(defaults).not.toContain('StarshipDefaults');
  });

  it('uses null for optional float fields and empty string for optional strings', () => {
    const merged = mergeSchemas(
      [
        createEnvironmentSchema('develop', developStarshipSchema),
        createEnvironmentSchema('staging', stagingStarshipSchema),
        createEnvironmentSchema('production', productionStarshipSchema)
      ],
      'develop'
    );

    const defaults = generateDefaults(merged);

    expect(defaults).toContain("name: '',");
    expect(defaults).toContain('length: null,');
  });
});

describe('generated compatibility helpers', () => {
  it('filters args that are unavailable in the active environment', async () => {
    const merged = mergeSchemas(
      [
        createEnvironmentSchema('develop', developQueryDataSchema),
        createEnvironmentSchema('staging', stagingQueryDataSchema)
      ],
      'develop'
    );

    const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { pathToFileURL } = await import('node:url');
    const tempDir = await mkdtemp(
      join(tmpdir(), 'graphql-schema-env-sync-defaults-')
    );
    const helperPath = join(tempDir, 'defaults.ts');

    try {
      const defaultsContent = generateDefaults(merged).split(
        '// --- Runtime document adaptation ---'
      )[0];
      await writeFile(helperPath, defaultsContent, 'utf8');
      const helpers = await import(pathToFileURL(helperPath).href);

      expect(
        helpers.filterOperationArgs('staging', 'Query', 'getQueryData', {
          age: 30,
          name: 'Ada'
        })
      ).toEqual({ age: 30 });

      expect(
        helpers.filterOperationArgs('develop', 'Query', 'getQueryData', {
          age: 30,
          name: 'Ada'
        })
      ).toEqual({ age: 30, name: 'Ada' });

      expect(
        helpers.isOperationAvailable('staging', 'Query', 'getQueryData')
      ).toBe(true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
