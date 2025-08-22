import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReportFiltersCompare from '../src/pages/Reports/components/ReportFiltersCompare.jsx';

beforeEach(() => {
  const catalog = {
    systems: [{ id: 'S01' }, { id: 'S02' }],
    devices: [
      {
        systemId: 'S01',
        layerId: 'L01',
        deviceId: 'D1',
        sensors: [{ sensorName: 'Temp' }, { sensorName: 'pH' }],
      },
      {
        systemId: 'S02',
        layerId: 'L02',
        deviceId: 'D2',
        sensors: [{ sensorName: 'Lux' }],
      },
    ],
  };
  window.localStorage.setItem('deviceCatalog', JSON.stringify(catalog));
});

afterEach(() => {
  window.localStorage.clear();
});

test('filters sensors based on selected system', async () => {
  render(
    <ReportFiltersCompare
      fromDate=""
      toDate=""
      onFromDateChange={() => {}}
      onToDateChange={() => {}}
      rangeLabel=""
    />
  );

  // initially sensors from both systems are visible
  await screen.findByText('Lux');
  expect(screen.getByText('Lux')).toBeInTheDocument();
  expect(screen.getByText('Temp')).toBeInTheDocument();

  // select only system S01
  fireEvent.click(screen.getByLabelText('S01'));

  // lux sensor (from S02) should disappear
  await waitFor(() => {
    expect(screen.queryByText('Lux')).toBeNull();
  });

  // sensor from S01 remains
  expect(screen.getByText('Temp')).toBeInTheDocument();
});

