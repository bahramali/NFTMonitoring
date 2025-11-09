import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReportFiltersCompare from '../src/pages/Reports/components/ReportFiltersCompare.jsx';

test('displays sensor labels from catalog metadata', async () => {
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
          {
            systemId: 'S1',
            layerId: 'L1',
            deviceId: 'D1',
            sensors: [
              { sensorType: 'humidity' },
              { sensorType: 'temperature' },
              { sensorType: 'co2' },
            ],
          },
        ],
      }}
      airq={{ values: [] }}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: /expand systems list/i }));
  const deviceCheckbox = await screen.findByLabelText('D1');
  fireEvent.click(deviceCheckbox);

  await waitFor(() => {
    expect(screen.getByLabelText('co2')).not.toBeDisabled();
  });
  expect(screen.queryByLabelText('CO2')).not.toBeInTheDocument();
});
