import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import DailyBandChart from './DailyBandChart';

test('renders line chart for provided data', () => {
    const data = [
        { time: '00:00', intensity: 1 },
        { time: '01:00', intensity: 2 }
    ];
    const { container } = render(<DailyBandChart data={data} band="F6" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
});
