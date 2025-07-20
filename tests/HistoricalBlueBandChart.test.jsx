import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import HistoricalBlueBandChart from '../src/components/HistoricalBlueBandChart';

describe('HistoricalBlueBandChart', () => {
    const now = Date.now();
    const mockData = [
        {
            time: now - 3600 * 1000,
            F1: 100,
            F2: 150,
            clear: 200,
            nir: 30,
        },
        {
            time: now,
            F1: 110,
            F2: 160,
            clear: 210,
            nir: 40,
        },
    ];

    it('renders without crashing', () => {
        const { container } = render(<HistoricalBlueBandChart data={mockData} />);
        expect(container).toBeTruthy();
    });
});
