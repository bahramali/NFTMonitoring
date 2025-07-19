import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import HistoricalMultiBandChart from '../src/components/HistoricalMultiBandChart';

describe('HistoricalMultiBandChart', () => {
    const mockData = [
        { timestamp: '2025-07-15T00:00:00Z', min: 1, max: 5, avg: 3 },
        { timestamp: '2025-07-15T01:00:00Z', min: 2, max: 6, avg: 4 },
    ];

    it('renders without crashing', () => {
        const { container } = render(<HistoricalMultiBandChart data={mockData} />);
        expect(container).toBeTruthy();
    });
});
