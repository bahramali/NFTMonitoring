import React from 'react';
import { vi } from 'vitest';

const { referenceAreaMock } = vi.hoisted(() => ({
    referenceAreaMock: vi.fn(({ children, ...props }) => (
        <div data-testid="reference-area" {...props}>
            {children}
        </div>
    )),
}));

vi.mock('recharts', async () => {
    const Stub = ({ children }) => <div>{children}</div>;
    return {
        ResponsiveContainer: ({ width = 800, height = 400, children }) => (
            <div style={{ width, height }}>{children}</div>
        ),
        ReferenceArea: referenceAreaMock,
        BarChart: Stub,
        Bar: Stub,
        XAxis: Stub,
        YAxis: Stub,
        CartesianGrid: Stub,
        Tooltip: Stub,
        Label: Stub,
        Cell: Stub,
    };
});

vi.mock('../src/context/SensorConfigContext.jsx', () => ({
    useSensorConfig: () => ({
        configs: {
            temperature: { idealRange: { min: 20, max: 30 } },
            '415nm': { idealRange: { min: 0, max: 100 } },
        },
    }),
    SensorConfigProvider: ({ children }) => <div>{children}</div>,
}));

import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SpectrumBarChart from '../src/pages/Live/components/SpectrumBarChart';
import { SensorConfigProvider } from '../src/context/SensorConfigContext.jsx';


Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    value: 800,
});
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    value: 400,
});

test('renders spectrum bar chart', () => {
    const data = {
        F1: 1, F2: 2, F3: 3, F4: 4,
        F5: 5, F6: 6, F7: 7, F8: 8,
        clear: 9, nir: 10,
    };

    const { container } = render(
        <SensorConfigProvider>
            <div style={{ width: 800, height: 400 }}>
                <SpectrumBarChart sensorData={data} />
            </div>
        </SensorConfigProvider>
    );

  expect(container.firstChild).toBeInTheDocument();
});

test('renders reference area when ideal range is provided', async () => {
    const data = { F1: 50 };

    const { container } = render(
        <SensorConfigProvider>
            <div style={{ width: 800, height: 400 }}>
                <SpectrumBarChart sensorData={data} />
            </div>
        </SensorConfigProvider>
    );

    await waitFor(() => {
        expect(container.querySelectorAll('[data-testid="reference-area"]').length).toBe(1);
    });
});

test('renders spectrum bar chart for as7343 data', () => {
    const data = {
        '405nm': 1, '425nm': 2, '450nm': 3, '475nm': 4,
        '515nm': 5, '550nm': 6, '555nm': 7, '600nm': 8,
        '640nm': 9, '690nm': 10, '745nm': 11,
        VIS1: 12, VIS2: 13, NIR855: 14,
    };

    const { container } = render(
        <SensorConfigProvider>
            <div style={{ width: 800, height: 400 }}>
                <SpectrumBarChart sensorData={data} />
            </div>
        </SensorConfigProvider>
    );

    expect(container.firstChild).toBeInTheDocument();
});
