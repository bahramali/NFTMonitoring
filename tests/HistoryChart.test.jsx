import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import HistoryChart from '../src/components/HistoryChart';

beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        value: 600,
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
        configurable: true,
        value: 300,
    });
});

describe('HistoryChart', () => {
    const mockData = [
        { time: Date.now() - 3600 * 1000, value: 1 },
        { time: Date.now(), value: 2 },
    ];

    it('renders without crashing', () => {
        render(
            <HistoryChart
                data={mockData}
                xDataKey="time"
                yDataKey="value"
                yLabel="Value"
                title="Test Chart"
            />,
        );
    });

    it('renders a recharts container', () => {
        const { container } = render(
            <HistoryChart data={mockData} xDataKey="time" yDataKey="value" yLabel="Value" />,
        );
        const rechartsWrapper = container.querySelector('.recharts-responsive-container');
        expect(rechartsWrapper).toBeTruthy();
    });
});

