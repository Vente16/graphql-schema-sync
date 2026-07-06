import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generate } from '../index.js';
import {
  developStarshipSchema,
  stagingStarshipSchema
} from './fixtures/starship-schemas.js';

const fetchMock = vi.fn();

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('generate', () => {
  it('writes compatibility outputs using fetched schemas', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: developStarshipSchema })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: stagingStarshipSchema })
      });
    vi.stubGlobal('fetch', fetchMock);

    const tempDir = await mkdtemp(join(tmpdir(), 'graphql-schema-env-sync-'));
    const configPath = join(tempDir, 'config.mjs');

    await writeFile(
      configPath,
      `export default {
  environments: {
    develop: 'https://develop.example.com/graphql',
    staging: 'https://staging.example.com/graphql',
  },
  baseEnvironment: 'develop',
  output: {
    compatSchema: './generated/schema.compat.graphql',
    types: './generated/graphql.ts',
    report: './generated/compat-report.json',
    defaults: './generated/defaults.ts',
  },
};`
    );

    try {
      const result = await generate({
        cwd: tempDir,
        configPath,
        skipCodegen: true
      });

      const compatSchema = await readFile(
        result.outputFiles.compatSchema,
        'utf8'
      );
      const report = JSON.parse(
        await readFile(result.outputFiles.report, 'utf8')
      );
      const defaults = await readFile(result.outputFiles.defaults, 'utf8');

      expect(compatSchema).toContain('type Starship');
      expect(report.summary.fieldsWithDifferences).toBeGreaterThan(0);
      expect(defaults).toContain('normalizeStarship');
      expect(result.outputFiles.types).toBeUndefined();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
