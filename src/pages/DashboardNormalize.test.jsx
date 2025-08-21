import { describe, it, expect } from 'vitest';
import { normalizeLiveNow } from './DashboardPage.jsx';

// Sample payload matching new live_now JSON structure
const samplePayload = {
  systems: {
    S01: {
      systemId: 'S01',
      status: 'Active',
      devicesOnline: 1,
      devicesTotal: 2,
      sensorsHealthy: 3,
      sensorsTotal: 4,
      lastUpdate: 1700000000000,
      environment: {
        light: { average: 12, deviceCount: 1 },
        humidity: { average: 55, deviceCount: 1 },
        temperature: { average: 25, deviceCount: 1 }
      },
      water: {
        dissolvedTemp: { average: 20, deviceCount: 1 },
        dissolvedOxygen: { average: 5, deviceCount: 1 },
        dissolvedEC: { average: 1.23, deviceCount: 1 },
        dissolvedTDS: { average: 200, deviceCount: 1 },
        pH: { average: 7.5, deviceCount: 1 }
      },
      actuators: {
        airPump: { average: 1, deviceCount: 1 }
      },
      layers: [
        {
          id: 'L01',
          environment: {
            light: { average: 15, deviceCount: 1 },
            temperature: { average: 22, deviceCount: 1 },
            humidity: { average: 60, deviceCount: 1 }
          },
          water: {
            dissolvedTemp: { average: 21, deviceCount: 1 },
            dissolvedOxygen: { average: 6, deviceCount: 1 },
            dissolvedEC: { average: 1.1, deviceCount: 1 },
            dissolvedTDS: { average: 150, deviceCount: 1 },
            pH: { average: 7, deviceCount: 1 }
          },
          actuators: {
            airpump: { average: 1, deviceCount: 1 }
          }
        },
        {
          id: 'layer2',
          environment: {},
          water: {},
          actuators: {}
        }
      ]
    }
  }
};

describe('normalizeLiveNow', () => {
  it('parses systems and layers and maps metrics correctly', () => {
    const systems = normalizeLiveNow(samplePayload);

    expect(systems).toHaveLength(1);
    const sys = systems[0];
    expect(sys.systemId).toBe('S01');
    // system-level metrics
    expect(sys.metrics.light).toBe(12);
    expect(sys.metrics.humidity).toBe(55);
    expect(sys.metrics.temperature).toBe(25);
    expect(sys.metrics.airPump).toBe(true);
    expect(sys.metrics._counts.light).toBe(1);
    // layer summary counts
    expect(sys.layers).toHaveLength(2);
    expect(sys.layers.map(l => l.id)).toEqual(['L01', 'L02']);
    expect(sys.layers[0].health).toBe('ok');
    expect(sys.layers[1].health).toBe('down');
    // layer card metrics
    const layer1 = sys._layerCards[0];
    expect(layer1.metrics.lux).toBe(15);
    expect(layer1.metrics.humidity).toBe(60);
    expect(layer1.water.pH).toBe(7);
    expect(layer1.actuators.airPump).toBe(true);
    // counts propagate
    expect(layer1.metrics._counts.light).toBe(1);
    const layer2 = sys._layerCards[1];
    expect(layer2.id).toBe('L02');
    expect(layer2.metrics.lux).toBe(null);
  });
});
