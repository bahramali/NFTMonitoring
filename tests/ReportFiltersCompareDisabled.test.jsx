import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReportFiltersCompare from '../src/pages/Reports/components/ReportFiltersCompare.jsx';

beforeEach(() => {
  const catalog = {
    systems: [{ id: 'S1' }],
    devices: [
      { systemId: 'S1', layerId: 'L1', deviceId: 'D1', sensors: [{ sensorName: 'humidity' }] },
      { systemId: 'S1', layerId: 'L1', deviceId: 'D2', sensors: [{ sensorName: 'temperature' }] },
    ],
  };
  window.localStorage.setItem('deviceCatalog', JSON.stringify(catalog));
});

afterEach(() => {
  window.localStorage.clear();
});

test('enables only sensors for selected device', async () => {
  render(
    <ReportFiltersCompare
      fromDate=""
      toDate=""
      onFromDateChange={() => {}}
      onToDateChange={() => {}}
      rangeLabel=""
    />
  );
  const d1 = await screen.findByLabelText('D1');
  const humidity = screen.getByLabelText('humidity');
  const temperature = screen.getByLabelText('temperature');

  // initially both disabled
  expect(humidity).toBeDisabled();
  expect(temperature).toBeDisabled();

  // select first device
  d1.click();

  await waitFor(() => {
    expect(humidity).not.toBeDisabled();
  });
  expect(temperature).toBeDisabled();
});
