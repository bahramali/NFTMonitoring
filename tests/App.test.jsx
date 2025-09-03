import React from 'react';
import App from '../src/App';
import { renderWithProviders } from './utils/renderWithProviders';
import { mockSensorConfigApi } from './mocks/sensorConfigApi';

beforeEach(() => { mockSensorConfigApi(); });

test('renders App component', () => {
    const { container } = renderWithProviders(<App />);
    expect(container).toBeDefined();
});
