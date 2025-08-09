import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import HistoricalMultiBandChart from '../src/components/HistoricalMultiBandChart';

describe('HistoricalMultiBandChart', () => {
  const now = Date.now();
  const mockData = [
    {
      time: now - 3600 * 1000,
      '405nm': 100,
      '425nm': 150,
      F4: 200,
      '555nm': 50,
      VIS1: 80,
      VIS2: 90,
      NIR855: 30,
    },
    {
      time: now,
      '405nm': 110,
      '425nm': 160,
      F4: 210,
      '555nm': 60,
      VIS1: 85,
      VIS2: 95,
      NIR855: 40,
    },
  ];

  it('renders without crashing', () => {
    const { container } = render(
      <HistoricalMultiBandChart
        data={mockData}
        bandKeys={['405nm', '425nm', 'F4', '555nm', 'VIS1', 'VIS2', 'NIR855']}
      />
    );
    expect(container).toBeTruthy();
  });
});
