import React from 'react';
import SensorConfig from '../src/pages/SensorConfig';
import { renderWithProviders } from './utils/renderWithProviders';
import { mockSensorConfigApi } from './mocks/sensorConfigApi';
import { screen, fireEvent, within } from '@testing-library/react';
import { vi } from 'vitest';

// mock scrollTo for JSDOM
  beforeAll(() => { window.scrollTo = vi.fn(); });


beforeEach(() => { mockSensorConfigApi(); vi.clearAllMocks(); });

const savedOrUpdated = /saved|updated/i;

async function findRow(sensorType, topicLabel) {
  const cells = await screen.findAllByRole('cell', { name: sensorType });
  for (const cell of cells) {
    const row = cell.closest('tr');
    if (!row) continue;
    const topicCell = topicLabel
      ? within(row).queryByText(topicLabel)
      : within(row).queryByText('—');
    if (topicCell) return row;
  }
  throw new Error(`Row not found for ${sensorType} (${topicLabel || 'no topic'})`);
}

test('create a config (assert Saved)', async () => {
  await renderWithProviders(<SensorConfig />);

  const topicInput = document.querySelector('input[name="topic"]');
  const metricInput = document.querySelector('input[name="metric"]');
  const minInput = document.querySelector('input[name="minValue"]');
  const maxInput = document.querySelector('input[name="maxValue"]');
  if (!topicInput || !metricInput || !minInput || !maxInput) {
    throw new Error('Form inputs not found');
  }

  fireEvent.change(topicInput, {
    target: { value: '/topic/growSensors' },
  });
  fireEvent.change(metricInput, {
    target: { value: 'A_RH_C' },
  });
  fireEvent.change(minInput, {
    target: { name: 'minValue', value: '40' },
  });
  fireEvent.change(maxInput, {
    target: { name: 'maxValue', value: '60' },
  });
  fireEvent.click(screen.getByRole('button', { name: /create/i }));

  expect(await screen.findByText(savedOrUpdated)).toBeInTheDocument();

  expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/sensor-config'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          sensorType: 'A_RH_C@@/topic/growSensors',
          topic: '/topic/growSensors',
          minValue: 40,
          maxValue: 60,
          description: '',
        }),
      }),
  );
});

test('update a config via top form (assert Saved)', async () => {
  await renderWithProviders(<SensorConfig />);

  const row = await findRow('A_Temp_C', '/topic/growSensors');

  // pick the exact top-form edit button to avoid ambiguity
  const editTopBtn = within(row).getByTitle('Edit in form');
  fireEvent.click(editTopBtn);

  const minInput = document.querySelector('input[name="minValue"]');
  fireEvent.change(minInput, {
    target: { name: 'minValue', value: '15' },
  });
  const maxInput = document.querySelector('input[name="maxValue"]');
  fireEvent.change(maxInput, {
    target: { name: 'maxValue', value: '30' },
  });
  fireEvent.click(screen.getByRole('button', { name: /update/i }));

  expect(await screen.findByText(savedOrUpdated)).toBeInTheDocument();

  expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/sensor-config/A_Temp_C%40%40%2Ftopic%2FgrowSensors'),
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ minValue: 15, maxValue: 30, description: '', topic: '/topic/growSensors' }),
      }),
  );
});

test('update a config via inline edit (assert Saved)', async () => {
  await renderWithProviders(<SensorConfig />);

  const row = await findRow('A_Temp_C', '/topic/growSensors');

  // pick the exact inline edit button (✎)
  const inlineBtn = within(row).getByTitle('Inline edit');
  fireEvent.click(inlineBtn);

  // first two number inputs are Min and Max
  const numbers = within(row).getAllByRole('spinbutton');
  fireEvent.change(numbers[0], { target: { value: '15' } });
  fireEvent.change(numbers[1], { target: { value: '30' } });

  // save inline changes
  const saveBtn = within(row).getByRole('button', { name: /save/i });
  fireEvent.click(saveBtn);

  expect(await screen.findByText(savedOrUpdated)).toBeInTheDocument();

  expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/sensor-config/A_Temp_C%40%40%2Ftopic%2FgrowSensors'),
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ minValue: 15, maxValue: 30, description: '', topic: '/topic/growSensors' }),
      }),
  );
});
