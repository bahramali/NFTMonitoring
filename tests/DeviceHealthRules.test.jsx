import { describe, expect, test } from 'vitest';
import { evaluateDeviceHealth } from '../src/pages/Overview/utils/deviceHealth.js';

const nowMs = 1_700_000_000_000;

const baseInput = {
  nowMs,
  lastSeenMs: nowMs - 10_000,
  msgRate: 6,
  expectedIntervalSec: 10,
  expectedMetrics: {
    critical: ['ph', 'ec'],
    optional: ['solutionTemp']
  },
  metrics: { ph: 6.1, ec: 1.2, solutionTemp: 21.5 },
  payloadError: false
};

describe('evaluateDeviceHealth', () => {
  test('marks device offline when past threshold', () => {
    const result = evaluateDeviceHealth({
      ...baseInput,
      lastSeenMs: nowMs - 200_000
    });
    expect(result.status).toBe('offline');
  });

  test('marks device critical when missing critical metrics', () => {
    const result = evaluateDeviceHealth({
      ...baseInput,
      metrics: { solutionTemp: 21.5 }
    });
    expect(result.status).toBe('critical');
  });

  test('marks device degraded when msgRate below expected', () => {
    const result = evaluateDeviceHealth({
      ...baseInput,
      msgRate: 2
    });
    expect(result.status).toBe('degraded');
  });

  test('marks device critical on payload error', () => {
    const result = evaluateDeviceHealth({
      ...baseInput,
      payloadError: true
    });
    expect(result.status).toBe('critical');
  });

  test('returns ok when nominal', () => {
    const result = evaluateDeviceHealth({
      ...baseInput
    });
    expect(result.status).toBe('ok');
  });
});
