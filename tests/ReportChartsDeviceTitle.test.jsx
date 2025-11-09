import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';

import ReportCharts from '../src/pages/Reports/components/ReportCharts';

vi.mock('../src/components/HistoryChart', () => ({ default: () => <div /> }));

function setup() {
  render(
    <ReportCharts
      rangeByCid={{}}
      tempByCid={{}}
      phByCid={{}}
      ecTdsByCid={{}}
      doByCid={{}}
      xDomain={[]}
      selectedDevice="L01G03"
      selectedSensors={['temperature']}
    />
  );
}

test('adds selected device to chart titles', () => {
  setup();
  expect(screen.getByText('Temperature (L01G03)')).toBeInTheDocument();
  expect(screen.queryByText('Humidity (L01G03)')).not.toBeInTheDocument();
});
