import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import SpectrumBarChart from '../src/components/SpectrumBarChart';

test('renders spectrum bar chart', () => {
    const data = {
        F1: 1, F2: 2, F3: 3, F4: 4,
        F5: 5, F6: 6, F7: 7, F8: 8,
        clear: 9, nir: 10,
    };
    const { container } = render(<SpectrumBarChart sensorData={data} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
});
