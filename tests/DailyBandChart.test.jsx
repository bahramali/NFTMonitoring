import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import DailyBandChart from '../src/components/DailyBandChart';

test('renders line chart for provided data', () => {
    const data = [
        { time: 0, intensity: 10 },
        { time: 1, intensity: 15 }
    ];
    const { container } = render(<DailyBandChart data={data} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
});
