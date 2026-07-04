import { describe, expect, it } from 'vitest';
import {
  isInternalTypeName,
  isNamedType,
  isRequiredType,
  makeNullableSdl,
  typeRefToSdl
} from '../introspection-utils.js';

describe('introspection-utils', () => {
  it('converts scalar, list, and non-null type refs to SDL', () => {
    expect(typeRefToSdl({ kind: 'SCALAR', name: 'String' })).toBe('String');
    expect(
      typeRefToSdl({
        kind: 'NON_NULL',
        ofType: { kind: 'SCALAR', name: 'ID' }
      })
    ).toBe('ID!');
    expect(
      typeRefToSdl({
        kind: 'LIST',
        ofType: {
          kind: 'NON_NULL',
          ofType: { kind: 'SCALAR', name: 'String' }
        }
      })
    ).toBe('[String!]');
  });

  it('can force nullable SDL from a non-null type ref', () => {
    expect(
      typeRefToSdl(
        {
          kind: 'NON_NULL',
          ofType: { kind: 'SCALAR', name: 'String' }
        },
        { forceNullable: true }
      )
    ).toBe('String');
  });

  it('detects required types and strips non-null suffix', () => {
    expect(
      isRequiredType({
        kind: 'NON_NULL',
        ofType: { kind: 'SCALAR', name: 'String' }
      })
    ).toBe(true);
    expect(isRequiredType({ kind: 'SCALAR', name: 'String' })).toBe(false);
    expect(makeNullableSdl('String!')).toBe('String');
    expect(makeNullableSdl('String')).toBe('String');
  });

  it('identifies internal and named introspection types', () => {
    expect(isInternalTypeName('__Schema')).toBe(true);
    expect(isInternalTypeName('User')).toBe(false);
    expect(
      isNamedType({
        kind: 'OBJECT',
        name: 'User',
        fields: [],
        interfaces: []
      })
    ).toBe(true);
    expect(isNamedType({ kind: 'SCALAR', name: 'String' })).toBe(true);
  });
});
