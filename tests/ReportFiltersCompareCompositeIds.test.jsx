import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReportFiltersCompare from '../src/pages/Reports/components/ReportFiltersCompare.jsx';

test('lists composite IDs for selected system, layer and device', () => {
  render(
    <ReportFiltersCompare
      fromDate=""
      toDate=""
      onFromDateChange={() => {}}
      onToDateChange={() => {}}
      systems={["S01"]}
      layers={["L02"]}
      devices={[{ value: 'S01-L02-D2', label: 'D2' }]}
      rangeLabel=""
    />
  );

  expect(screen.queryByText('S01-L02-D2')).toBeNull();

  fireEvent.click(screen.getByLabelText('S01'));
  fireEvent.click(screen.getByLabelText('L02'));
  fireEvent.click(screen.getByLabelText('D2'));

  expect(screen.getByText('S01-L02-D2')).toBeInTheDocument();
});

