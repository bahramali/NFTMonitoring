import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import HistoricalTrendsPanel from '../src/pages/Germination/components/HistoricalTrendsPanel.jsx';

test('shows empty state message in the chart area when no devices exist', () => {
  render(
    <HistoricalTrendsPanel
      deviceOptions={[]}
      selectedCompositeId=""
      onCompositeChange={() => {}}
      availableMetrics={[]}
      selectedMetricKey=""
      onMetricChange={() => {}}
      rangePreset="1h"
      rangeOptions={[{ key: '1h', label: 'Last hour' }]}
      onRangePreset={() => {}}
      customFrom=""
      customTo=""
      onCustomFrom={() => {}}
      onCustomTo={() => {}}
      onRefresh={() => {}}
      chartError=""
      chartLoading={false}
      chartSeries={[]}
      chartYLabel=""
      chartDomain={null}
      emptyStateMessage="No sensors available for this rack yet."
    />,
  );

  expect(
    screen.queryByText('Select a sensor and metric to view historical trends.'),
  ).not.toBeInTheDocument();
  expect(
    screen.getAllByText('No sensors available for this rack yet.'),
  ).toHaveLength(2);
});
