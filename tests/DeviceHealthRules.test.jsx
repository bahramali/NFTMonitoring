import { describe, expect, test } from 'vitest';
import { computeMetricTrend, evaluateDeviceHealth, getTrendDirection, getWorstHealthStatus } from '../src/pages/Overview/utils/deviceHealth.js';

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

describe('getWorstHealthStatus', () => {
  test('returns worst status by priority', () => {
    const result = getWorstHealthStatus(['ok', 'degraded', 'critical', 'offline']);
    expect(result).toBe('offline');
  });

  test('returns ok when all ok', () => {
    const result = getWorstHealthStatus(['ok', 'ok']);
    expect(result).toBe('ok');
  });
});

describe('trend helpers', () => {
  test('getTrendDirection respects thresholds', () => {
    expect(getTrendDirection(0.6, 0.5)).toBe('up');
    expect(getTrendDirection(-0.6, 0.5)).toBe('down');
    expect(getTrendDirection(0.2, 0.5)).toBe('flat');
  });

  test('computeMetricTrend returns delta from window baseline', () => {
    const samples = [
      { timestamp: nowMs - 20 * 60 * 1000, metrics: { ph: 6.1 } },
      { timestamp: nowMs - 10 * 60 * 1000, metrics: { ph: 6.3 } },
    ];
    const result = computeMetricTrend({
      samples,
      metricKey: 'ph',
      currentValue: 6.5,
      nowMs,
      windowMs: 15 * 60 * 1000,
    });
    expect(result.delta).toBeCloseTo(0.4);
    expect(result.direction).toBe('up');
  });
});
