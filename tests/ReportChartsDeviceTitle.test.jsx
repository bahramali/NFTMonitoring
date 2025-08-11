import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';

import ReportCharts from '../src/components/dashboard/ReportCharts';

vi.mock('../src/components/HistoricalTemperatureChart', () => ({ default: () => <div /> }));
vi.mock('../src/components/HistoricalMultiBandChart', () => ({ default: () => <div /> }));
vi.mock('../src/components/HistoricalClearLuxChart', () => ({ default: () => <div /> }));
vi.mock('../src/components/HistoricalPhChart', () => ({ default: () => <div /> }));
vi.mock('../src/components/HistoricalEcTdsChart', () => ({ default: () => <div /> }));
vi.mock('../src/components/HistoricalDoChart', () => ({ default: () => <div /> }));

function setup() {
  render(
    <ReportCharts
      showTempHum
      showSpectrum={false}
      showClearLux={false}
      showPh={false}
      showEcTds={false}
      showDo={false}
      rangeData={[]}
      tempRangeData={[]}
      phRangeData={[]}
      ecTdsRangeData={[]}
      doRangeData={[]}
      xDomain={[]}
      selectedDevice="L01G03"
    />
  );
}

test('adds selected device to chart titles', () => {
  setup();
  expect(screen.getByText('Temperature(L01G03)')).toBeInTheDocument();
});
