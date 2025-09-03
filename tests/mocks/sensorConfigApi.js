// tests/mocks/sensorConfigApi.js
import { vi } from 'vitest';

export function mockSensorConfigApi() {
  // حالت ساده: در حافظه نگه می‌داریم
  const db = {
    temperature: { key: 'temperature', minValue: 20, maxValue: 30, description: '' },
  };

  const makeRes = (ok, status, body) => ({
    ok,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  });

  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = (opts.method || 'GET').toUpperCase();
    const { pathname } = typeof url === 'string' ? new URL(url, 'https://api.hydroleaf.se') : url;

    if (pathname === '/api/sensor-config' && method === 'GET') {
      return makeRes(true, 200, Object.values(db));
    }

    const m = pathname.match(/^\/api\/sensor-config\/([^/]+)$/);
    if (m) {
      const key = decodeURIComponent(m[1]);

      if (method === 'POST') {
        if (db[key]) return makeRes(false, 409, 'Duplicate key');
        const p = JSON.parse(opts.body || '{}');
        db[key] = { key, ...p };
        return makeRes(true, 201, db[key]);
      }

      if (method === 'PUT') {
        if (!db[key]) return makeRes(false, 404, 'Not found');
        const p = JSON.parse(opts.body || '{}');
        db[key] = { key, ...p };
        return makeRes(true, 200, db[key]);
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
