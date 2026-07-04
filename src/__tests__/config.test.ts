import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig, resolveEnvironments } from '../config.js';
import type { SchemaSyncConfig } from '../types.js';

const fixturesDir = resolve(import.meta.dirname, 'fixtures');

describe('resolveEnvironments', () => {
  it('resolves string URLs with auto-incremented priority', () => {
    const config: SchemaSyncConfig = {
      environments: {
        develop: 'https://dev.example.com/graphql',
        staging: 'https://staging.example.com/graphql'
      },
      baseEnvironment: 'develop',
      output: {
        compatSchema: './a.graphql',
        types: './b.ts',
        report: './c.json',
        defaults: './d.ts'
      }
    };

    const resolved = resolveEnvironments(config);

    expect(resolved).toEqual([
      {
        name: 'develop',
        url: 'https://dev.example.com/graphql',
        priority: 1,
        headers: {}
      },
      {
        name: 'staging',
        url: 'https://staging.example.com/graphql',
        priority: 2,
        headers: {}
      }
    ]);
  });

  it('respects explicit priority and merges headers', () => {
    const config: SchemaSyncConfig = {
      environments: {
        develop: {
          url: 'https://dev.example.com/graphql',
          priority: 10,
          headers: { Authorization: 'Bearer dev' }
        },
        production: {
          url: 'https://prod.example.com/graphql',
          priority: 1
        }
      },
      baseEnvironment: 'develop',
      headers: { 'X-App': 'graphql-schema-sync' },
      output: {
        compatSchema: './a.graphql',
        types: './b.ts',
        report: './c.json',
        defaults: './d.ts'
      }
    };

    const resolved = resolveEnvironments(config);

    expect(resolved[0].name).toBe('production');
    expect(resolved[1].name).toBe('develop');
    expect(resolved[1].headers).toEqual({
      'X-App': 'graphql-schema-sync',
      Authorization: 'Bearer dev'
    });
  });
});

describe('loadConfig', () => {
  it('loads a valid config file', async () => {
    const config = await loadConfig(resolve(fixturesDir, 'valid-config.mjs'));

    expect(config.baseEnvironment).toBe('develop');
    expect(config.environments.develop).toBe('http://localhost:4101/graphql');
  });

  it('throws when config file does not exist', async () => {
    await expect(
      loadConfig(resolve(fixturesDir, 'missing-config.mjs'))
    ).rejects.toThrow('Config file not found');
  });

  it('throws when baseEnvironment is not defined in environments', async () => {
    await expect(
      loadConfig(resolve(fixturesDir, 'invalid-base-config.mjs'))
    ).rejects.toThrow(
      'baseEnvironment "staging" is not defined in environments'
    );
  });

  it('throws when environments object is empty', async () => {
    await expect(
      loadConfig(resolve(fixturesDir, 'invalid-empty-envs-config.mjs'))
    ).rejects.toThrow('Invalid graphql-schema-sync config');
  });
});
