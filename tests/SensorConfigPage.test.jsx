// tests/SensorConfigPage.test.jsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SensorConfig from '../src/pages/SensorConfig';
import { SensorConfigProvider } from '../src/context/SensorConfigContext.jsx';
import { mockSensorConfigApi } from './mocks/sensorConfigApi.js';
import { vi } from 'vitest';

const renderPage = () =>
    render(
        <SensorConfigProvider>
          <SensorConfig />
        </SensorConfigProvider>
    );

beforeEach(() => {
  mockSensorConfigApi(); // make sure mocked API resolves Promises
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('create a config (asserts on Saved + form reset)', async () => {
  renderPage();

  fireEvent.change(screen.getByLabelText(/Key:/i), { target: { value: 'humidity' } });
  fireEvent.change(screen.getByLabelText(/Min:/i), { target: { value: '40' } });
  fireEvent.change(screen.getByLabelText(/Max:/i), { target: { value: '60' } });
  fireEvent.change(screen.getByLabelText(/Description:/i), { target: { value: 'Humidity sensor' } });

  fireEvent.click(screen.getByRole('button', { name: /create/i }));

  // backend/ctx done → پیام موفقیت
  expect(await screen.findByText(/saved/i)).toBeInTheDocument();

  // فرم باید ریست شود
  expect(screen.getByLabelText(/Key:/i)).toHaveValue('');
  expect(screen.getByLabelText(/Min:/i)).toHaveValue(null); // number input clears to empty
  expect(screen.getByLabelText(/Max:/i)).toHaveValue(null);
});

test('update a config (writes both min & max, asserts on Saved)', async () => {
  renderPage();

  // شروع ادیت روی اولین ردیف
  const editBtn = await screen.findByRole('button', { name: /edit/i });
  fireEvent.click(editBtn);

  // هر دو مقدار لازم هستند
  const minInput = screen.getByLabelText(/Min:/i);
  const maxInput = screen.getByLabelText(/Max:/i);

  fireEvent.change(minInput, { target: { value: '15' } });
  fireEvent.change(maxInput, { target: { value: '30' } });

  fireEvent.click(screen.getByRole('button', { name: /update/i }));

  // موفقیت
  expect(await screen.findByText(/saved/i)).toBeInTheDocument();

  // خروج از حالت ادیت (key دوباره قابل ویرایش می‌شود)
  expect(screen.getByLabelText(/Key:/i)).not.toBeDisabled();
});
