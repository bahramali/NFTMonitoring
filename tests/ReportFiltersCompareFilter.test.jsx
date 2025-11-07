import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReportFiltersCompare from '../src/pages/Reports/components/ReportFiltersCompare.jsx';

test('shows sensors disabled before any device is selected', async () => {
  render(
    <ReportFiltersCompare
      fromDate=""
      toDate=""
      onFromDateChange={() => {}}
      onToDateChange={() => {}}
      rangeLabel=""
      catalog={{
        systems: [{ id: 'S1' }],
        devices: [
          { systemId: 'S1', layerId: 'L1', deviceId: 'D1', sensors: [{ sensorName: 'humidity' }] },
          { systemId: 'S1', layerId: 'L1', deviceId: 'D2', sensors: [{ sensorName: 'temperature' }] },
        ],
      }}
      water={{ options: [], values: [] }}
    />
  );
  await waitFor(() => {
    expect(screen.getByLabelText('humidity')).toBeDisabled();
  });
  expect(screen.getByLabelText('temperature')).toBeDisabled();
  expect(screen.getByLabelText('dissolvedTemp')).toBeDisabled();
});
