// tests/mocks/sensorConfigApi.js
import { vi } from 'vitest';

export function mockSensorConfigApi() {
  // حالت ساده: در حافظه نگه می‌داریم
  const db = {
    'temperature@@/topic/growSensors': {
      sensorType: 'temperature@@/topic/growSensors',
      topic: '/topic/growSensors',
      minValue: 20,
      maxValue: 30,
      description: '',
    },
    'temperature@@/topic/waterTank': {
      sensorType: 'temperature@@/topic/waterTank',
      topic: '/topic/waterTank',
      minValue: 18,
      maxValue: 26,
      description: '',
    },
    '415nm': { sensorType: '415nm', minValue: 0, maxValue: 100, description: '' },
  };

  const makeRes = (ok, status, body) => ({
    ok,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  });

  const withIdealRange = cfg => ({
    ...cfg,
    idealRange: {
      min: cfg.minValue,
      max: cfg.maxValue,
    },
  });

  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = (opts.method || 'GET').toUpperCase();
    const { pathname } = typeof url === 'string' ? new URL(url, 'https://api.hydroleaf.se') : url;

    if ((pathname === '/api/sensor-config' || pathname === '/api/sensor-config/') && method === 'GET') {
      return makeRes(true, 200, Object.values(db).map(withIdealRange));
    }

    if ((pathname === '/api/sensor-config' || pathname === '/api/sensor-config/') && method === 'POST') {
      const { sensorType, ...rest } = JSON.parse(opts.body || '{}');
      const key = sensorType;
      if (!key) return makeRes(false, 400, 'Missing sensorType');
      if (db[key]) return makeRes(false, 409, 'Duplicate key');
      db[key] = { sensorType: key, ...rest };
      return makeRes(true, 201, withIdealRange(db[key]));
    }

    const m = pathname.match(/^\/api\/sensor-config\/([^/]+)$/);
    if (m) {
      const key = decodeURIComponent(m[1]);

      if (method === 'PUT') {
        if (!db[key]) return makeRes(false, 404, 'Not found');
        const { sensorType: _sensorType, ...rest } = JSON.parse(opts.body || '{}');
        db[key] = { sensorType: key, ...rest };
        return makeRes(true, 200, withIdealRange(db[key]));
      }

      if (method === 'DELETE') {
        if (!db[key]) return makeRes(false, 404, 'Not found');
        delete db[key];
        return makeRes(true, 204, '');
      }
    }

    return makeRes(false, 404, 'Not mocked');
  });
}
