import React from 'react';
import SensorConfig from '../src/pages/SensorConfig';
import { renderWithProviders } from './utils/renderWithProviders';
import { mockSensorConfigApi } from './mocks/sensorConfigApi';
import { screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

beforeEach(() => { mockSensorConfigApi(); });

test('create a config (assert Saved)', async () => {
  renderWithProviders(<SensorConfig />);

  fireEvent.change(screen.getByLabelText(/Sensor Type:/i), { target: { value: 'humidity' } });
  fireEvent.change(screen.getByLabelText(/Min:/i), { target: { value: '40' } });
  fireEvent.change(screen.getByLabelText(/Max:/i), { target: { value: '60' } });
  fireEvent.click(screen.getByRole('button', { name: /create/i }));

  expect(await screen.findByText(/saved/i)).toBeInTheDocument();
});

test('update a config (assert Saved)', async () => {
  renderWithProviders(<SensorConfig />);

  const edit = await screen.findByRole('button', { name: /edit/i });
  fireEvent.click(edit);
  fireEvent.change(screen.getByLabelText(/Min:/i), { target: { value: '15' } });
  fireEvent.change(screen.getByLabelText(/Max:/i), { target: { value: '30' } });
  fireEvent.click(screen.getByRole('button', { name: /update/i }));

  expect(await screen.findByText(/saved/i)).toBeInTheDocument();
});
