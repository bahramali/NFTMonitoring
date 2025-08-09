import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import HistoricalMultiBandChart from '../src/components/HistoricalMultiBandChart';

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

  it('renders checkboxes to toggle bands', () => {
    const { container, getByLabelText } = render(
      <HistoricalMultiBandChart
        data={mockData}
        bandKeys={['405nm', '425nm', 'F4', '555nm', 'VIS1', 'VIS2', 'NIR855']}
      />
    );
    const cb405 = getByLabelText('405nm');
    expect(cb405).toBeInTheDocument();
    const cbAll = getByLabelText('All');
    expect(cbAll).toBeInTheDocument();
    expect(cb405).toBeChecked();
    fireEvent.click(cb405);
    expect(cb405).not.toBeChecked();
    fireEvent.click(cbAll);
    expect(cb405).toBeChecked();
  });
});
