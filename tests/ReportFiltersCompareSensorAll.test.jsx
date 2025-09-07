import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReportFiltersCompare from '../src/pages/Reports/components/ReportFiltersCompare.jsx';

test('All selects all sensors and notifies parent', () => {
  const onAllWater = vi.fn();
  render(
    <ReportFiltersCompare
      fromDate=""
      toDate=""
      onFromDateChange={() => {}}
      onToDateChange={() => {}}
      onApply={() => {}}
      onReset={() => {}}
      onAddCompare={() => {}}
      onExportCsv={() => {}}
      rangeLabel=""
      water={{ values: [] }}
      onAllWater={onAllWater}
      onNoneWater={() => {}}
    />
  );

  fireEvent.click(screen.getByLabelText('All', { selector: 'input[name="water"]' }));
  const labels = onAllWater.mock.calls[0][0].map((o) => (typeof o === 'string' ? o : o.label));
  expect(labels).toEqual(['dissolvedTemp', 'dissolvedEC', 'dissolvedTDS', 'DO']);
});
