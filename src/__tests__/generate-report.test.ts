import { describe, expect, it } from 'vitest';
import { generateCompatReportHtml } from '../generate-report-html.js';
import { generateCompatReport } from '../generate-report.js';
import { mergeSchemas } from '../merge-schemas.js';
import { createEnvironmentSchema } from './helpers.js';
import {
  developStarshipSchema,
  productionStarshipSchema,
  stagingStarshipSchema
} from './fixtures/starship-schemas.js';

describe('generateCompatReport', () => {
  const schemas = [
    createEnvironmentSchema('develop', developStarshipSchema),
    createEnvironmentSchema('staging', stagingStarshipSchema),
    createEnvironmentSchema('production', productionStarshipSchema)
  ];

  it('builds a per-environment report from merged schema', () => {
    const merged = mergeSchemas(schemas, 'develop');
    const report = generateCompatReport(merged);

    expect(report.baseEnvironment).toBe('develop');
    expect(report.environments).toEqual(['develop', 'staging', 'production']);
    expect(report.summary.totalTypes).toBeGreaterThan(0);
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    expect(report.byEnvironment.develop).toMatchObject({
      role: 'base',
      types: ['LengthUnit', 'Starship'],
      queries: ['starship'],
      mutations: []
    });

    expect(report.byEnvironment.staging).toMatchObject({
      role: 'target',
      missedQueries: [],
      missedMutations: []
    });

    const stagingMissedTypes = report.byEnvironment.staging;
    expect(stagingMissedTypes.role).toBe('target');
    if (stagingMissedTypes.role === 'target') {
      expect(stagingMissedTypes.missedTypes).toEqual([
        {
          name: 'Starship',
          kind: 'OBJECT',
          missedFields: ['name']
        }
      ]);
    }

    const productionMissedTypes = report.byEnvironment.production;
    if (productionMissedTypes.role === 'target') {
      expect(productionMissedTypes.missedTypes).toEqual([
        {
          name: 'Starship',
          kind: 'OBJECT',
          missedFields: ['length', 'name']
        }
      ]);
    }

    const nameDiff = report.differences.find(
      entry => entry.field === 'Starship.name'
    );
    expect(nameDiff).toEqual({
      type: 'Starship',
      field: 'Starship.name',
      availableIn: ['develop'],
      missingIn: ['staging', 'production'],
      madeOptional: true
    });
  });

  it('returns empty misses when schemas are identical', () => {
    const merged = mergeSchemas(
      [
        createEnvironmentSchema('develop', developStarshipSchema),
        createEnvironmentSchema('staging', developStarshipSchema)
      ],
      'develop'
    );
    const report = generateCompatReport(merged);

    expect(report.summary.fieldsWithDifferences).toBe(0);
    expect(report.differences).toEqual([]);

    const staging = report.byEnvironment.staging;
    expect(staging.role).toBe('target');
    if (staging.role === 'target') {
      expect(staging.missedTypes).toEqual([]);
      expect(staging.missedQueries).toEqual([]);
      expect(staging.missedMutations).toEqual([]);
    }
  });

  it('generates an HTML report with environment sections', () => {
    const merged = mergeSchemas(schemas, 'develop');
    const report = generateCompatReport(merged);
    const html = generateCompatReportHtml(report);

    expect(html).toContain('<title>GraphQL Schema Sync Report</title>');
    expect(html).toContain('<h2>develop</h2>');
    expect(html).toContain('<h3>types</h3>');
    expect(html).toContain('<h3>missed types</h3>');
    expect(html).toContain('<code>Starship</code>');
    expect(html).toContain('<code>name</code>');
  });
});
