import { describe, expect, it } from 'vitest';
import { buildSkippedOperationData } from '../adapt-document.js';

describe('apollo-link', () => {
  it('builds null root fields for skipped operations', () => {
    expect(buildSkippedOperationData(['getMovie'])).toEqual({
      getMovie: null
    });
  });
});
