import { describe, it, expect } from 'vitest';
import { isWaterDevice } from '../src/pages/Overview/utils/isWaterDevice.js';

describe('isWaterDevice', () => {
  it('detects water device IDs', () => {
    expect(isWaterDevice('T01')).toBe(true);
    expect(isWaterDevice('D01')).toBe(false);
  });
});
