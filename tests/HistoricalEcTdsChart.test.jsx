import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import HistoricalEcTdsChart from '../src/components/HistoricalEcTdsChart';
import { vi } from 'vitest';

// 🧪 mock کردن محدوده‌های ایده‌آل EC و TDS
vi.mock('../src/idealRangeConfig', () => ({
  __esModule: true,
  default: {
    ec: { idealRange: { min: 1.1, max: 1.8 } },
    tds: { idealRange: { min: 700, max: 1200 } },
  },
}));

// ⚠️ برای اینکه Recharts تو محیط test درست کار کنه
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

describe('HistoricalEcTdsChart', () => {
  const mockData = [
    { time: Date.now() - 3600 * 1000, ec: 1.2, tds: 900 },
    { time: Date.now(), ec: 1.3, tds: 1000 },
  ];

  it('renders without crashing', () => {
    render(<HistoricalEcTdsChart data={mockData} />);
  });

  it('renders a recharts container', () => {
    const { container } = render(<HistoricalEcTdsChart data={mockData} />);
    const rechartsWrapper = container.querySelector('.recharts-responsive-container');
    expect(rechartsWrapper).toBeTruthy();
  });

  it('shows reference areas for ideal EC and TDS ranges', () => {
    const { container } = render(<HistoricalEcTdsChart data={mockData} />);
    const refs = container.querySelectorAll('.recharts-reference-area-rect');
    expect(refs.length).toBeGreaterThan(0);
  });
});
