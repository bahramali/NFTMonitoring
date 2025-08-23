import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReportFiltersCompare from '../src/pages/Reports/components/ReportFiltersCompare.jsx';

beforeEach(() => {
  const catalog = {
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
  };
  window.localStorage.setItem('deviceCatalog', JSON.stringify(catalog));
});

afterEach(() => {
  window.localStorage.clear();
});

test('selecting multiple devices enables union of sensors', async () => {
  render(
    <ReportFiltersCompare
      fromDate=""
      toDate=""
      onFromDateChange={() => {}}
      onToDateChange={() => {}}
      rangeLabel=""
    />
  );

  const humidity = screen.getByLabelText('humidity');
  const temperature = screen.getByLabelText('temperature');

  // both disabled initially
  expect(humidity).toBeDisabled();
  expect(temperature).toBeDisabled();

  // select first device
  fireEvent.click(screen.getByLabelText('D1'));

  await waitFor(() => {
    expect(humidity).not.toBeDisabled();
  });
  expect(temperature).toBeDisabled();

  // select second device
  fireEvent.click(screen.getByLabelText('D2'));

  await waitFor(() => {
    expect(temperature).not.toBeDisabled();
  });
});

