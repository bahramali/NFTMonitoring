import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import DailyTemperatureChart from '../src/components/DailyTemperatureChart';
import { vi } from 'vitest';

// 🧪 mock کردن محدوده‌های ایده‌آل دما و رطوبت
vi.mock('../idealRangeConfig', () => ({
    __esModule: true,
    default: {
        temperature: { idealRange: { min: 20, max: 26 } },
        humidity: { idealRange: { min: 40, max: 60 } },
    },
}));

// ⚠️ Recharts به offsetWidth/Height نیاز داره
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

describe('DailyTemperatureChart', () => {
    const mockData = [
        {
            time: Date.now() - 3600 * 1000,
            temperature: 23.5,
            humidity: 55,
        },
        {
            time: Date.now(),
            temperature: 24.2,
            humidity: 52,
        },
    ];

    it('renders without crashing', () => {
        render(<DailyTemperatureChart data={mockData} />);
    });

    it('renders a recharts container', () => {
        const { container } = render(<DailyTemperatureChart data={mockData} />);
        const rechartsWrapper = container.querySelector('.recharts-responsive-container');
        expect(rechartsWrapper).toBeTruthy(); // فقط وجود container کافی است
    });
});
