import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SensorConfig from '../src/pages/SensorConfig';
import { SensorConfigProvider } from '../src/context/SensorConfigContext.jsx';
import { mockSensorConfigApi } from './mocks/sensorConfigApi.js';
import { vi } from 'vitest';

const renderPage = () => {
  mockSensorConfigApi();
  return render(
    <SensorConfigProvider>
      <SensorConfig />
    </SensorConfigProvider>
  );
};

afterEach(() => {
  vi.restoreAllMocks();
});

test('creates a new sensor config', async () => {
  renderPage();
  await screen.findByText('temperature');
  fireEvent.change(screen.getByLabelText('Key:'), { target: { value: 'humidity' } });
  fireEvent.change(screen.getByLabelText('Min:'), { target: { value: '40' } });
  fireEvent.change(screen.getByLabelText('Max:'), { target: { value: '60' } });
  fireEvent.change(screen.getByLabelText('Description:'), { target: { value: 'Humidity sensor' } });
  fireEvent.click(screen.getByText('Create'));
  await screen.findByText('humidity');
});

test('updates an existing sensor config', async () => {
  renderPage();
  const editBtn = await screen.findByRole('button', { name: 'Edit' });
  fireEvent.click(editBtn);
  const minInput = screen.getByLabelText('Min:');
  fireEvent.change(minInput, { target: { value: '15' } });
  fireEvent.click(screen.getByText('Update'));
  await waitFor(() => expect(screen.getByText('15')).toBeInTheDocument());
});

test('deletes an existing sensor config', async () => {
  renderPage();
  const delBtn = await screen.findByRole('button', { name: 'Delete' });
  fireEvent.click(delBtn);
  await waitFor(() => expect(screen.queryByText('temperature')).not.toBeInTheDocument());
});
