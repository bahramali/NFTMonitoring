import React from 'react';
import { renderWithProviders } from './utils/renderWithProviders';
import { mockSensorConfigApi } from './mocks/sensorConfigApi';
import App from '../src/App';

beforeEach(() => {
    mockSensorConfigApi();
});

test('redirects root path to store with replace', async () => {
    window.history.pushState({}, '', '/');

    renderWithProviders(<App />);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(window.location.pathname).toBe('/store');
});
