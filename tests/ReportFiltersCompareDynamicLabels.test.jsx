import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReportFiltersCompare from '../src/pages/Reports/components/ReportFiltersCompare.jsx';

test('displays sensor labels provided via topic data', () => {
  render(
    <ReportFiltersCompare
      fromDate=""
      toDate=""
      onFromDateChange={() => {}}
      onToDateChange={() => {}}
      rangeLabel=""
      topics={[{ id: 'growSensors', label: 'Grow Sensors' }]}
      topicSensors={{ growSensors: [{ label: 'CO2' }, { label: 'temperature' }] }}
      selectedTopics={['growSensors']}
      selectedTopicSensors={{ growSensors: [] }}
    />
  );

  expect(screen.getByLabelText('CO2')).toBeInTheDocument();
  expect(screen.getByLabelText('temperature')).toBeInTheDocument();
});
