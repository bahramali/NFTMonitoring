import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import ReportsUX from '../src/components/reports/ReportsUX';
import { FiltersProvider } from '../src/context/FiltersContext';

test('ReportsUX invokes callback with selected filters', () => {
  const onRun = vi.fn();
  const initialLists = {
    timings: ['Daily'],
    locations: ['Lab'],
    sensorTypes: ['Temp'],
  };

  render(
    <FiltersProvider initialLists={initialLists}>
      <ReportsUX onRun={onRun} />
    </FiltersProvider>
  );

  fireEvent.click(screen.getByLabelText('Daily'));
  fireEvent.click(screen.getByRole('button', { name: /run/i }));

  expect(onRun).toHaveBeenCalledWith({ timing: ['Daily'], location: [], sensorType: [] });
});
