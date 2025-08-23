import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';

import ReportCharts from '../src/pages/Reports/components/ReportCharts';

vi.mock('../src/components/HistoryChart', () => ({ default: () => <div /> }));

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
