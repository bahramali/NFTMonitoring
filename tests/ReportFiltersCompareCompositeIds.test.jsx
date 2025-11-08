import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import ReportFiltersCompare from '../src/pages/Reports/components/ReportFiltersCompare.jsx';

const catalog = {
  systems: [
    { id: 'S01', compositeIds: ['S01-L01-D1'] },
    { id: 'S02', compositeIds: ['S02-L02-D2'] },
  ],
  devices: [
    { systemId: 'S01', layerId: 'L01', deviceId: 'D1', deviceName: 'Device 1' },
    { systemId: 'S02', layerId: 'L02', deviceId: 'D2', deviceName: 'Device 2' },
  ],
};

test('location tree is collapsed by default and expands on demand', async () => {
  render(
    <ReportFiltersCompare
      fromDate=""
      toDate=""
      onFromDateChange={() => {}}
      onToDateChange={() => {}}
      rangeLabel=""
      catalog={catalog}
    />
  );

  expect(screen.queryByLabelText('S01')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /expand systems list/i }));

  expect(await screen.findByLabelText('S01')).toBeInTheDocument();
  expect(screen.getByLabelText('Device 1')).toBeInTheDocument();
});

test('selecting a device updates summary and triggers apply handler', async () => {
  const onApply = vi.fn();

  render(
    <ReportFiltersCompare
      fromDate=""
      toDate=""
      onFromDateChange={() => {}}
      onToDateChange={() => {}}
      rangeLabel=""
      catalog={catalog}
      onApply={onApply}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: /expand systems list/i }));

  fireEvent.click(await screen.findByLabelText('Device 1'));

  await waitFor(() => {
    expect(onApply).toHaveBeenCalled();
  });

  const labels = await screen.findAllByText('Device 1');
  expect(labels.length).toBeGreaterThan(0);
});

test('selecting a system selects all nested devices', async () => {
  render(
    <ReportFiltersCompare
      fromDate=""
      toDate=""
      onFromDateChange={() => {}}
      onToDateChange={() => {}}
      rangeLabel=""
      catalog={catalog}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: /expand systems list/i }));

  fireEvent.click(await screen.findByLabelText('S02'));

  await waitFor(() => {
    expect(screen.getByLabelText('Device 2')).toBeChecked();
  });
});
