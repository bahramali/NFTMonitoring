import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import DailyTemperatureChart from './DailyTemperatureChart';

test('renders temperature line chart', () => {
    const data = [
        { time: '00:00', temperature: 20 },
        { time: '01:00', temperature: 21 }
    ];
    const { container } = render(<DailyTemperatureChart data={data} />);
    const lines = container.querySelectorAll('.recharts-line');
    expect(lines.length).toBe(1);
});
