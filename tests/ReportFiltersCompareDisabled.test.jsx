import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReportFiltersCompare from '../src/pages/Reports/components/ReportFiltersCompare.jsx';

test('sensors for selected topic are enabled', () => {
  render(
    <ReportFiltersCompare
      fromDate=""
      toDate=""
      onFromDateChange={() => {}}
      onToDateChange={() => {}}
      rangeLabel=""
      topics={[{ id: 'growSensors', label: 'Grow Sensors' }]}
      topicSensors={{ growSensors: [{ label: 'dissolvedTemp' }, { label: 'A_Temp_C' }] }}
      selectedTopics={['growSensors']}
      selectedTopicSensors={{ growSensors: [] }}
    />
  );

  expect(screen.getByLabelText('dissolvedTemp')).toBeEnabled();
  expect(screen.getByLabelText('A_Temp_C')).toBeEnabled();
});
