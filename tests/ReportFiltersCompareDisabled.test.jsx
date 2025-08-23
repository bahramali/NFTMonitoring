import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReportFiltersCompare from '../src/pages/Reports/components/ReportFiltersCompare.jsx';

beforeEach(() => {
  const catalog = {
    systems: [{ id: 'S01' }],
    devices: [
      { systemId: 'S01', layerId: 'L01', deviceId: 'D1', sensors: [{ sensorName: 'Temp' }] },
      { systemId: 'S01', layerId: 'L01', deviceId: 'D2', sensors: [{ sensorName: 'Lux' }] },
    ],
  };
  window.localStorage.setItem('deviceCatalog', JSON.stringify(catalog));
});

afterEach(() => {
  window.localStorage.clear();
});

test('non-matching device sensors remain disabled', async () => {
  render(
    <ReportFiltersCompare
      fromDate=""
      toDate=""
      onFromDateChange={() => {}}
      onToDateChange={() => {}}
      rangeLabel=""
      selectedDevice="D1"
    />
  );
  const temp = await screen.findByLabelText('Temp');
  const lux = await screen.findByLabelText('Lux');
  expect(temp).not.toBeDisabled();
  expect(lux).toBeDisabled();
});
