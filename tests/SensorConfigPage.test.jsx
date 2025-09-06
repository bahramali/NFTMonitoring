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

test('create a config (assert Saved)', async () => {
  renderWithProviders(<SensorConfig />);

  // be strict on labels to avoid matching sort buttons
  fireEvent.change(screen.getByLabelText(/^Sensor Type:?$/i), {
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
          sensorType: 'humidity',
          minValue: 40,
          maxValue: 60,
          description: '',
        }),
      }),
  );
});

test('update a config via top form (assert Saved)', async () => {
  renderWithProviders(<SensorConfig />);

  const row = (await screen.findByText('temperature', { selector: 'td' })).closest('tr');

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
      expect.stringContaining('/api/sensor-config/temperature'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ minValue: 15, maxValue: 30, description: '' }),
      }),
  );
});

test('update a config via inline edit (assert Saved)', async () => {
  renderWithProviders(<SensorConfig />);

  const row = (await screen.findByText('temperature', { selector: 'td' })).closest('tr');

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
      expect.stringContaining('/api/sensor-config/temperature'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ minValue: 15, maxValue: 30, description: '' }),
      }),
  );
});
