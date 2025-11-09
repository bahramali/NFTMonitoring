import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReportFiltersCompare from '../src/pages/Reports/components/ReportFiltersCompare.jsx';

test('renders message when no topic is selected', () => {
  render(
    <ReportFiltersCompare
      fromDate=""
      toDate=""
      onFromDateChange={() => {}}
      onToDateChange={() => {}}
      rangeLabel=""
      topics={[{ id: 'growSensors', label: 'Grow Sensors' }]}
      topicSensors={{ growSensors: [{ label: 'humidity' }] }}
      selectedTopics={[]}
      selectedTopicSensors={{ growSensors: [] }}
    />
  );

  expect(screen.getByText(/choose a topic/i)).toBeInTheDocument();
});
