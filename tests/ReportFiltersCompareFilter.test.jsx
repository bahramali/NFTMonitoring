import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import ReportFiltersCompare from '../src/pages/Reports/components/ReportFiltersCompare.jsx';

beforeEach(() => {
  const catalog = {
    systems: [{ id: 'S1' }],
    devices: [
      { systemId: 'S1', layerId: 'L1', deviceId: 'D1', sensors: [{ sensorName: 'humidity' }] },
      { systemId: 'S1', layerId: 'L1', deviceId: 'D2', sensors: [{ sensorName: 'temperature' }] },
    ],
  };
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => catalog,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('shows sensors disabled before any device is selected', async () => {
  render(
    <ReportFiltersCompare
      fromDate=""
      toDate=""
      onFromDateChange={() => {}}
      onToDateChange={() => {}}
      rangeLabel=""
      water={{ options: [], values: [] }}
    />
  );
  await waitFor(() => {
    expect(screen.getByLabelText('humidity')).toBeDisabled();
  });
  expect(screen.getByLabelText('temperature')).toBeDisabled();
  expect(screen.getByLabelText('dissolvedTemp')).toBeDisabled();
});
