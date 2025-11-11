import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import ReportFiltersCompare from '../src/pages/Reports/components/ReportFiltersCompare';
import { vi } from 'vitest';

test('topic All/None triggers callbacks', () => {
  const onAllTopics = vi.fn();
  const onNoneTopics = vi.fn();

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
      topicSensors={{ growSensors: [{ label: 'A_Temp_C' }] }}
      selectedTopicSensors={{ growSensors: [] }}
      selectedTopics={['growSensors']}
      onAllTopics={onAllTopics}
      onNoneTopics={onNoneTopics}
    />
  );

  fireEvent.click(screen.getByLabelText('All', { selector: 'input[name="topics-allnone"]' }));
  expect(onAllTopics).toHaveBeenCalled();

  fireEvent.click(screen.getByLabelText('None', { selector: 'input[name="topics-allnone"]' }));
  expect(onNoneTopics).toHaveBeenCalled();
});
