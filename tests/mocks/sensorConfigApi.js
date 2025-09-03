import configsData from '../data/sensorConfigs.json';
import { vi } from 'vitest';

export function mockSensorConfigApi() {
  let configs = { ...configsData };
  global.fetch = vi.fn(async (url, options = {}) => {
    const method = (options.method || 'GET').toUpperCase();
    if (url === '/api/sensor-config' && method === 'GET') {
      return { ok: true, json: async () => configs };
    }
    if (url === '/api/sensor-config' && method === 'POST') {
      const body = JSON.parse(options.body);
      const { key, ...cfg } = body;
      configs[key] = cfg;
      return { ok: true, json: async () => cfg };
    }
    const match = url.match(/^\/api\/sensor-config\/([^/]+)$/);
    if (match && method === 'PUT') {
      const key = decodeURIComponent(match[1]);
      const cfg = JSON.parse(options.body);
      configs[key] = cfg;
      return { ok: true, json: async () => cfg };
    }
    if (match && method === 'DELETE') {
      const key = decodeURIComponent(match[1]);
      delete configs[key];
      return { ok: true, json: async () => ({}) };
    }
    return { ok: false, json: async () => ({}) };
  });
  return { getConfigs: () => configs };
}
