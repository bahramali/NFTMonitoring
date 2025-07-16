import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import MultiBandChart from '../src/components/MultiBandChart';

vi.mock('recharts', async () => {
    const actual = await vi.importActual('recharts');
    return {
        ...actual,
        ResponsiveContainer: ({ width = 800, height = 300, children }) =>
            React.cloneElement(children, { width, height }),
    };
});

test('renders multi-band line chart', () => {
    const data = [
        { time: 0, F1: 1, F2: 2 },
        { time: 1, F1: 2, F2: 3 }
    ];
    const { container } = render(<MultiBandChart data={data} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
});
