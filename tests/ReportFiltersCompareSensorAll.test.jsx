import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReportFiltersCompare from '../src/pages/Reports/components/ReportFiltersCompare.jsx';
import { vi } from 'vitest';

test('All selects all sensors for the chosen topic', () => {
  const onAllTopicSensors = vi.fn();
  render(
    <ReportFiltersCompare
      fromDate=""
      toDate=""
      onFromDateChange={() => {}}
      onToDateChange={() => {}}
      onApply={() => {}}
      onReset={() => {}}
      onAddCompare={() => {}}
      onExportCsv={() => {}}
      rangeLabel=""
      topics={[{ id: 'growSensors', label: 'Grow Sensors' }]}
      selectedTopics={['growSensors']}
      topicSensors={{ growSensors: [{ label: 'temperature' }, { label: 'humidity' }] }}
      selectedTopicSensors={{ growSensors: [] }}
      onAllTopicSensors={onAllTopicSensors}
      onNoneTopicSensors={() => {}}
    />
  );

  fireEvent.click(screen.getByLabelText('All', { selector: 'input[name="topic-growSensors"]' }));

  expect(onAllTopicSensors).toHaveBeenCalledTimes(1);
  expect(onAllTopicSensors).toHaveBeenCalledWith('growSensors', [
    { label: 'temperature', value: 'temperature' },
    { label: 'humidity', value: 'humidity' },
  ]);
});
