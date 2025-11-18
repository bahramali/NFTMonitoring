import React from 'react';
import App from '../src/App';
import { renderWithProviders } from './utils/renderWithProviders';
import { mockSensorConfigApi } from './mocks/sensorConfigApi';

beforeEach(() => { mockSensorConfigApi(); });

test('renders App component', async () => {
    const { container } = await renderWithProviders(<App />);
    expect(container).toBeDefined();
});
