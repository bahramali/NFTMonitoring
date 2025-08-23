import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReportFiltersCompare from '../src/pages/Reports/components/ReportFiltersCompare.jsx';

beforeEach(() => {
  const catalog = {
    systems: [
      { id: 'S01', compositeIds: ['S01-L01-D1'] },
      { id: 'S02', compositeIds: ['S02-L02-D2'] },
    ],
    devices: [
      { systemId: 'S01', layerId: 'L01', deviceId: 'D1' },
      { systemId: 'S02', layerId: 'L02', deviceId: 'D2' },
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

  expect(screen.getByLabelText('S01-L01-D1')).toBeInTheDocument();
  expect(screen.getByLabelText('S02-L02-D2')).toBeInTheDocument();
});

test('selecting composite id selects related location checkboxes', () => {
  render(
    <ReportFiltersCompare
      fromDate=""
      toDate=""
      onFromDateChange={() => {}}
      onToDateChange={() => {}}
      rangeLabel=""
    />
  );

  fireEvent.click(screen.getByLabelText('S01-L01-D1'));
  expect(screen.getByLabelText('S01')).toBeChecked();
  expect(screen.getByLabelText('L01')).toBeChecked();
  expect(screen.getByLabelText('D1')).toBeChecked();
});

test('selecting location checkboxes selects composite id', () => {
  render(
    <ReportFiltersCompare
      fromDate=""
      toDate=""
      onFromDateChange={() => {}}
      onToDateChange={() => {}}
      rangeLabel=""
    />
  );

  fireEvent.click(screen.getByLabelText('S02'));
  fireEvent.click(screen.getByLabelText('L02'));
  fireEvent.click(screen.getByLabelText('D2'));
  expect(screen.getByLabelText('S02-L02-D2')).toBeChecked();
});
