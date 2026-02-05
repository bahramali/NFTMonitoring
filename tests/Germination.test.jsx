import React from 'react';
import { renderWithProviders } from './utils/renderWithProviders.js';
import { screen, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import Germination from '../src/pages/Germination/index.jsx';

vi.mock('../src/pages/common/useLiveDevices', () => ({
  useLiveDevices: () => ({
    deviceData: {
      F01: {
        'hydroleaf/telemetry': {
          'F01|rack|germination|L01|G01': {
            deviceKey: 'F01|rack|germination|L01|G01',
            farmId: 'F01',
            unitType: 'rack',
            unitId: 'germination',
            layerId: 'L01',
            deviceId: 'G01',
            deviceName: 'Germination Rack A',
            sensors: [{ sensorType: 'temperature', value: 22 }],
            mqttTopic: 'hydroleaf/telemetry',
          },
          'F01|rack|grow|L01|G02': {
            deviceKey: 'F01|rack|grow|L01|G02',
            farmId: 'F01',
            unitType: 'rack',
            unitId: 'grow',
            layerId: 'L01',
            deviceId: 'G02',
            deviceName: 'Grow Rack A',
            sensors: [{ sensorType: 'temperature', value: 24 }],
            mqttTopic: 'hydroleaf/telemetry',
          },
        },
      },
    },
  }),
}));

vi.mock('../src/pages/common/Header', () => ({
  default: ({ title }) => <div data-testid="header">{title}</div>,
}));

vi.mock('../src/pages/Germination/components/GerminationCamera', () => ({
  default: () => <div data-testid="germination-camera" />,
}));

vi.mock('../src/components/HistoryChart.jsx', () => ({
  default: () => <div data-testid="history-chart" />,
}));

vi.mock('../src/api/germination.js', () => ({
  getGerminationStatus: vi.fn(() => Promise.resolve({ startTime: null })),
  triggerGerminationStart: vi.fn(() => Promise.resolve({ startTime: null })),
  updateGerminationStart: vi.fn(() => Promise.resolve({ startTime: null })),
}));

vi.mock('../src/api/http.js', () => ({
  authFetch: vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ sensors: [] }),
    })
  ),
}));

test('filters telemetry devices to germination rack only', async () => {
  await act(async () => {
    renderWithProviders(<Germination />);
  });

  const select = await screen.findByLabelText(/sensor node/i);
  await waitFor(() => {
    const optionLabels = Array.from(select.querySelectorAll('option')).map(
      (option) => option.textContent
    );
    expect(optionLabels).toEqual(['Germination Rack A']);
  });
});
