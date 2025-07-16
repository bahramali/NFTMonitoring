import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import DailyTemperatureChart from '../src/components/DailyTemperatureChart';

test('renders temperature and humidity line chart', () => {
    const data = [
        { time: 0, temperature: 20, humidity: 40 },
        { time: 1, temperature: 21, humidity: 42 }
    ];
    const { container } = render(<DailyTemperatureChart data={data} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
});
