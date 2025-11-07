import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReportFiltersCompare from '../src/pages/Reports/components/ReportFiltersCompare.jsx';

test('enables only sensors for selected device', async () => {
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
          { systemId: 'S1', layerId: 'L1', deviceId: 'D1', sensors: [{ sensorName: 'dissolvedTemp' }] },
          { systemId: 'S1', layerId: 'L1', deviceId: 'D2', sensors: [{ sensorName: 'temperature' }] },
        ],
      }}
      water={{ options: [], values: [] }}
    />
  );
  const d1 = await screen.findByLabelText('D1');
  const dissolved = screen.getByLabelText('dissolvedTemp');
  const temperature = screen.getByLabelText('temperature');

  // initially both disabled
  expect(dissolved).toBeDisabled();
  expect(temperature).toBeDisabled();

  // select first device
  d1.click();

  await waitFor(() => {
    expect(dissolved).not.toBeDisabled();
  });
  expect(temperature).toBeDisabled();
});
