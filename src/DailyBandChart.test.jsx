import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import DailyBandChart from './DailyBandChart';

test('renders line chart for provided data', () => {
    const data = [
        { time: 0, intensity: 1 },
        { time: 1, intensity: 2 }
    ];
    const { container } = render(<DailyBandChart data={data} band="F6" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
});
