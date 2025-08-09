import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import SpectrumBarChart from '../src/components/SpectrumBarChart';


Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    value: 800,
});
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    value: 400,
});

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

  expect(container.firstChild).toBeInTheDocument();
});

test('renders spectrum bar chart for as7343 data', () => {
    const data = {
        '405nm': 1, '425nm': 2, '450nm': 3, '475nm': 4,
        '515nm': 5, '550nm': 6, '555nm': 7, '600nm': 8,
        '640nm': 9, '690nm': 10, '745nm': 11,
        VIS1: 12, VIS2: 13, NIR855: 14,
    };

    const { container } = render(
        <div style={{ width: 800, height: 400 }}>
            <SpectrumBarChart sensorData={data} />
        </div>
    );

    expect(container.firstChild).toBeInTheDocument();
});
