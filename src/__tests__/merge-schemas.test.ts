import { describe, expect, it } from 'vitest';
import { generateCompatSdl } from '../generate-compat-sdl.js';
import { generateDefaults } from '../generate-defaults.js';
import { getSchemaDifferences, mergeSchemas } from '../merge-schemas.js';
import { createEnvironmentSchema } from './helpers.js';
import {
  developStarshipSchema,
  productionStarshipSchema,
  stagingStarshipSchema
} from './fixtures/starship-schemas.js';

describe('mergeSchemas', () => {
  const schemas = [
    createEnvironmentSchema('develop', developStarshipSchema),
    createEnvironmentSchema('staging', stagingStarshipSchema),
    createEnvironmentSchema('production', productionStarshipSchema)
  ];

  it('merges fields from all environments and makes missing fields optional', () => {
    const merged = mergeSchemas(schemas, 'develop');
    const starship = merged.types.find(type => type.name === 'Starship');

    expect(starship).toBeDefined();
    expect(starship?.fields?.map(field => field.name)).toEqual([
      'id',
      'length',
      'name'
    ]);

    const idField = starship?.fields?.find(field => field.name === 'id');
    const nameField = starship?.fields?.find(field => field.name === 'name');
    const lengthField = starship?.fields?.find(
      field => field.name === 'length'
    );

    expect(idField?.isRequiredInAll).toBe(true);
    expect(nameField?.isRequiredInAll).toBe(false);
    expect(nameField?.availability.environments).toEqual(['develop']);
    expect(nameField?.availability.missingIn).toEqual([
      'staging',
      'production'
    ]);
    expect(lengthField?.availability.environments).toEqual([
      'develop',
      'staging'
    ]);
    expect(lengthField?.availability.missingIn).toEqual(['production']);
  });

  it('throws when no schemas are provided', () => {
    expect(() => mergeSchemas([], 'develop')).toThrow(
      'At least one environment schema is required'
    );
  });

  it('lists schema differences including args and enum values', () => {
    const merged = mergeSchemas(schemas, 'develop');
    const differences = getSchemaDifferences(merged);

    expect(differences.some(entry => entry.field === 'Starship.name')).toBe(
      true
    );
    expect(differences.some(entry => entry.field === 'Starship.length')).toBe(
      true
    );
    expect(
      differences.some(entry => entry.field === 'Starship.length(unit)')
    ).toBe(true);
  });

  it('generates SDL with environment availability comments', () => {
    const merged = mergeSchemas(schemas, 'develop');
    const sdl = generateCompatSdl(merged);

    expect(sdl).toContain('type Starship');
    expect(sdl).toContain('Available in: develop');
    expect(sdl).toContain('Missing in: staging, production');
    expect(sdl).toContain('Missing in: production');
    expect(sdl).toContain('name: String');
    expect(sdl).toContain('length(unit: LengthUnit = METER): Float');
  });

  it('generates default normalizers for optional fields', () => {
    const merged = mergeSchemas(schemas, 'develop');
    const defaults = generateDefaults(merged);

    expect(defaults).toContain('export const StarshipDefaults');
    expect(defaults).toContain("name: '',");
    expect(defaults).toContain('length: null,');
    expect(defaults).toContain('export function normalizeStarship');
  });
});
