import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import SpectrumBarChart from '../src/components/SpectrumBarChart';

vi.mock('recharts', async () => {
    const actual = await vi.importActual('recharts');
    return {
        ...actual,
        ResponsiveContainer: ({ width = 800, height = 400, children }) =>
            React.cloneElement(children, { width, height }),
    };
});

test('renders spectrum bar chart', () => {
    const data = {
        F1: 1, F2: 2, F3: 3, F4: 4,
        F5: 5, F6: 6, F7: 7, F8: 8,
        clear: 9, nir: 10,
    };
    const { container } = render(
        <div style={{ width: 800, height: 400 }}>
            <SpectrumBarChart sensorData={data} />
        </div>
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
});
