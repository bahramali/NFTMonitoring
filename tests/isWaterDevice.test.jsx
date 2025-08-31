import { describe, it, expect } from 'vitest';
import { isWaterDevice } from '../src/pages/Dashboard/components/DashboardV2.jsx';

describe('isWaterDevice', () => {
  it('detects water device IDs', () => {
    expect(isWaterDevice('S01-L01-T01')).toBe(true);
    expect(isWaterDevice('S01-L01-D01')).toBe(false);
  });
});
