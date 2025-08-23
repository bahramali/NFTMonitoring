import React from 'react';
import { render, screen } from '@testing-library/react';
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

test('shows sensors disabled before any device is selected', () => {
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
  expect(screen.getByLabelText('humidity')).toBeDisabled();
  expect(screen.getByLabelText('temperature')).toBeDisabled();
  expect(screen.getByLabelText('dissolvedTemp')).toBeDisabled();
});
