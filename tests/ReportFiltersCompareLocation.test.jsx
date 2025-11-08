import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReportFiltersCompare from '../src/pages/Reports/components/ReportFiltersCompare.jsx';

test('selecting multiple devices enables union of sensors', async () => {
  render(
    <ReportFiltersCompare
      fromDate=""
      toDate=""
      onFromDateChange={() => {}}
      onToDateChange={() => {}}
      rangeLabel=""
      catalog={{
        systems: [{ id: 'S1' }, { id: 'S2' }],
        devices: [
          {
            systemId: 'S1',
            layerId: 'L1',
            deviceId: 'D1',
            sensors: [{ sensorName: 'humidity' }],
          },
          {
            systemId: 'S2',
            layerId: 'L2',
            deviceId: 'D2',
            sensors: [{ sensorName: 'temperature' }],
          },
        ],
      }}
    />
  );

  const humidity = await screen.findByLabelText('humidity');
  const temperature = await screen.findByLabelText('temperature');

  expect(humidity).toBeDisabled();
  expect(temperature).toBeDisabled();

  fireEvent.click(screen.getByRole('button', { name: /expand systems list/i }));

  const firstDevice = await screen.findByLabelText('D1');
  fireEvent.click(firstDevice);

  await waitFor(() => {
    expect(humidity).not.toBeDisabled();
  });
  expect(temperature).toBeDisabled();

  const secondDevice = await screen.findByLabelText('D2');
  fireEvent.click(secondDevice);

  await waitFor(() => {
    expect(temperature).not.toBeDisabled();
  });
});

