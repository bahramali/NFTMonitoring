import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import ReportsPage from '../src/pages/ReportsPage';

vi.mock('../src/components/reports/ReportsUX', () => ({
  default: () => <div>ReportsUX</div>,
}));

vi.mock('../src/components/Header', () => ({
  default: () => <div>Header</div>,
}));

test('Reports page renders ReportsUX component', () => {
  render(<ReportsPage />);
  expect(screen.getByText('ReportsUX')).toBeInTheDocument();
});
