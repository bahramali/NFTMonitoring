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
  renderWithProviders(<SensorConfig />);

  fireEvent.change(screen.getByLabelText(/^Topic:?$/i), {
    target: { value: '/topic/growSensors' },
  });
  fireEvent.change(screen.getByLabelText(/^Metric:?$/i), {
    target: { value: 'humidity' },
  });
  fireEvent.change(screen.getByLabelText(/^Min:?$/i), {
    target: { name: 'minValue', value: '40' },
  });
  fireEvent.change(screen.getByLabelText(/^Max:?$/i), {
    target: { name: 'maxValue', value: '60' },
  });
  fireEvent.click(screen.getByRole('button', { name: /create/i }));

  expect(await screen.findByText(savedOrUpdated)).toBeInTheDocument();

  expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/sensor-config'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          sensorType: 'humidity@@/topic/growSensors',
          topic: '/topic/growSensors',
          minValue: 40,
          maxValue: 60,
          description: '',
        }),
      }),
  );
});

test('update a config via top form (assert Saved)', async () => {
  renderWithProviders(<SensorConfig />);

  const row = await findRow('temperature', '/topic/growSensors');

  // pick the exact top-form edit button to avoid ambiguity
  const editTopBtn = within(row).getByTitle('Edit in form');
  fireEvent.click(editTopBtn);

  fireEvent.change(screen.getByLabelText(/^Min:?$/i), {
    target: { name: 'minValue', value: '15' },
  });
  fireEvent.change(screen.getByLabelText(/^Max:?$/i), {
    target: { name: 'maxValue', value: '30' },
  });
  fireEvent.click(screen.getByRole('button', { name: /update/i }));

  expect(await screen.findByText(savedOrUpdated)).toBeInTheDocument();

  expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/sensor-config/temperature%40%40%2Ftopic%2FgrowSensors'),
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ minValue: 15, maxValue: 30, description: '', topic: '/topic/growSensors' }),
      }),
  );
});

test('update a config via inline edit (assert Saved)', async () => {
  renderWithProviders(<SensorConfig />);

  const row = await findRow('temperature', '/topic/growSensors');

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
      expect.stringContaining('/api/sensor-config/temperature%40%40%2Ftopic%2FgrowSensors'),
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ minValue: 15, maxValue: 30, description: '', topic: '/topic/growSensors' }),
      }),
  );
});
