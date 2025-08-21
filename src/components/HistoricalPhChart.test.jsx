import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import HistoricalPhChart from './HistoricalPhChart';
import { vi } from 'vitest';

vi.mock('../config/idealRangeConfig', () => ({
    __esModule: true,
    default: {
        ph: { idealRange: { min: 5.5, max: 6.5 } },
    },
}));

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

describe('HistoricalPhChart', () => {
    const mockData = [
        { time: Date.now() - 3600 * 1000, ph: 6.2 },
        { time: Date.now(), ph: 6.4 },
    ];

    it('renders without crashing', () => {
        render(<HistoricalPhChart data={mockData} />);
    });

    it('renders a recharts container', () => {
        const { container } = render(<HistoricalPhChart data={mockData} />);
        const rechartsWrapper = container.querySelector('.recharts-responsive-container');
        expect(rechartsWrapper).toBeTruthy();
    });
});
