import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import ReportFiltersCompare from '../src/pages/Reports/components/ReportFiltersCompare';

test('All/None selects and deselects systems, layers and devices and notifies parent', async () => {
  const systems = ['S1', 'S2'];
  const layers = ['L1', 'L2'];
  const devices = ['D1', 'D2'];
  const systemSet = new Set();
  const layerSet = new Set();
  const deviceSet = new Set();
  const toggle = (set) => ({ target: { value } }) => {
    if (set.has(value)) set.delete(value); else set.add(value);
  };

  render(
    <ReportFiltersCompare
      fromDate=""
      toDate=""
      onFromDateChange={() => {}}
      onToDateChange={() => {}}
      onApply={() => {}}
      systems={systems}
      layers={layers}
      devices={devices}
      onSystemChange={toggle(systemSet)}
      onLayerChange={toggle(layerSet)}
      onDeviceChange={toggle(deviceSet)}
      onReset={() => {}}
      onAddCompare={() => {}}
      onExportCsv={() => {}}
      rangeLabel=""
    />
  );

  // Systems All -> selects all
  fireEvent.click(screen.getByLabelText('All', { selector: 'input[name="sys-allnone"]' }));
  await waitFor(() => {
    systems.forEach((s) => expect(screen.getByLabelText(s)).toBeChecked());
  });
  expect(systemSet.size).toBe(systems.length);

  // Systems None -> clears all
  fireEvent.click(screen.getByLabelText('None', { selector: 'input[name="sys-allnone"]' }));
  await waitFor(() => {
    systems.forEach((s) => expect(screen.getByLabelText(s)).not.toBeChecked());
  });
  expect(systemSet.size).toBe(0);

  // Layers All -> selects all
  fireEvent.click(screen.getByLabelText('All', { selector: 'input[name="lay-allnone"]' }));
  await waitFor(() => {
    layers.forEach((l) => expect(screen.getByLabelText(l)).toBeChecked());
  });
  expect(layerSet.size).toBe(layers.length);

  // Layers None -> clears all
  fireEvent.click(screen.getByLabelText('None', { selector: 'input[name="lay-allnone"]' }));
  await waitFor(() => {
    layers.forEach((l) => expect(screen.getByLabelText(l)).not.toBeChecked());
  });
  expect(layerSet.size).toBe(0);

  // Devices All -> selects all
  fireEvent.click(screen.getByLabelText('All', { selector: 'input[name="dev-allnone"]' }));
  await waitFor(() => {
    devices.forEach((d) => expect(screen.getByLabelText(d)).toBeChecked());
  });
  expect(deviceSet.size).toBe(devices.length);

  // Devices None -> clears all
  fireEvent.click(screen.getByLabelText('None', { selector: 'input[name="dev-allnone"]' }));
  await waitFor(() => {
    devices.forEach((d) => expect(screen.getByLabelText(d)).not.toBeChecked());
  });
  expect(deviceSet.size).toBe(0);
});
