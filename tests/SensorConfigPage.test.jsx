import React from 'react';
import SensorConfig from '../src/pages/SensorConfig';
import { renderWithProviders } from './utils/renderWithProviders';
import { mockSensorConfigApi } from './mocks/sensorConfigApi';
import { screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';

beforeEach(() => { mockSensorConfigApi(); });

test('create a config (assert Saved)', async () => {
  renderWithProviders(<SensorConfig />);

  fireEvent.change(screen.getByLabelText(/Sensor Type:/i), {
    target: { value: 'humidity' },
  });
  fireEvent.change(screen.getByLabelText(/Min:/i), {
    target: { name: 'minValue', value: '40' },
  });
  fireEvent.change(screen.getByLabelText(/Max:/i), {
    target: { name: 'maxValue', value: '60' },
  });
  fireEvent.click(screen.getByRole('button', { name: /create/i }));

  expect(await screen.findByText(/saved/i)).toBeInTheDocument();
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

test('update a config (assert Saved)', async () => {
  renderWithProviders(<SensorConfig />);

  const row = (await screen.findByText('temperature', { selector: 'td' })).closest('tr');
  const edit = within(row).getByRole('button', { name: /edit/i });
  fireEvent.click(edit);
  fireEvent.change(screen.getByLabelText(/Min:/i), {
    target: { name: 'minValue', value: '15' },
  });
  fireEvent.change(screen.getByLabelText(/Max:/i), {
    target: { name: 'maxValue', value: '30' },
  });
  fireEvent.click(screen.getByRole('button', { name: /update/i }));

  expect(await screen.findByText(/saved/i)).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/sensor-config/temperature'),
    expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ minValue: 15, maxValue: 30, description: '' }),
    }),
  );
});
