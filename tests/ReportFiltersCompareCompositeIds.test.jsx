import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReportFiltersCompare from '../src/pages/Reports/components/ReportFiltersCompare.jsx';

beforeEach(() => {
  const catalog = {
    systems: [
      { id: 'S01', compositeIds: ['S01-L01-D1'] },
      { id: 'S02', compositeIds: ['S02-L02-D2'] },
    ],
  };
  window.localStorage.setItem('deviceCatalog', JSON.stringify(catalog));
});

afterEach(() => {
  window.localStorage.clear();
});

test('lists composite IDs from local storage', () => {
  render(
    <ReportFiltersCompare
      fromDate=""
      toDate=""
      onFromDateChange={() => {}}
      onToDateChange={() => {}}
      rangeLabel=""
    />
  );

  expect(screen.getByText('S01-L01-D1')).toBeInTheDocument();
  expect(screen.getByText('S02-L02-D2')).toBeInTheDocument();
});
