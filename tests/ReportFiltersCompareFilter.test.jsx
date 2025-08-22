import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReportFiltersCompare from '../src/pages/Reports/components/ReportFiltersCompare.jsx';

test('displays sensor types from provided lists when catalog is absent', () => {
  render(
    <ReportFiltersCompare
      fromDate=""
      toDate=""
      onFromDateChange={() => {}}
      onToDateChange={() => {}}
      systems={[]}
      layers={[]}
      devices={[]}
      sensorNames={['SHT3x']}
      sensorTypes={['pH', 'temperature']}
      rangeLabel=""
    />
  );
  expect(screen.getByText('pH')).toBeInTheDocument();
  expect(screen.getByText('temperature')).toBeInTheDocument();
});
