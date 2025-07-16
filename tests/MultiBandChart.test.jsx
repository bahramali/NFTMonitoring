import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import MultiBandChart from '../src/components/MultiBandChart';

test('renders multi-band line chart', () => {
    const data = [
        { time: 0, F1: 1, F2: 2 },
        { time: 1, F1: 2, F2: 3 }
    ];
    const { container } = render(<MultiBandChart data={data} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
});
