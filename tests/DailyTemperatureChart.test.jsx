import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import DailyTemperatureChart from '../src/components/DailyTemperatureChart';

test('renders temperature line chart', () => {
    const data = [
        { time: 0, temperature: 20 },
        { time: 1, temperature: 21 }
    ];
    const { container } = render(<DailyTemperatureChart data={data} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
});
