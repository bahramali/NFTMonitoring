import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import ReportFiltersCompare from '../src/pages/Reports/components/ReportFiltersCompare.jsx';

const baseProps = {
  fromDate: '',
  toDate: '',
  onFromDateChange: () => {},
  onToDateChange: () => {},
  onApply: () => {},
  onReset: () => {},
  onAddCompare: () => {},
  onExportCsv: () => {},
  rangeLabel: '',
  topics: [
    { id: 'growSensors', label: 'Grow Sensors' },
  ],
  topicSensors: {
    growSensors: [{ label: 'temperature' }, { label: 'humidity' }],
  },
  selectedTopics: ['growSensors'],
  selectedTopicSensors: {
    growSensors: ['temperature'],
  },
};

test('sensor checkbox reflects selection and fires toggle callback', () => {
  const onToggleTopicSensor = vi.fn();
  render(
    <ReportFiltersCompare
      {...baseProps}
      onToggleTopicSensor={onToggleTopicSensor}
    />
  );

  const temperature = screen.getByLabelText('temperature');
  expect(temperature).toBeChecked();

  fireEvent.click(temperature);

  expect(onToggleTopicSensor).toHaveBeenCalledWith('growSensors', 'temperature');
});

test('None action requests clearing sensors for topic', () => {
  const onNoneTopicSensors = vi.fn();
  render(
    <ReportFiltersCompare
      {...baseProps}
      onNoneTopicSensors={onNoneTopicSensors}
    />
  );

  fireEvent.click(screen.getByLabelText('None', { selector: 'input[name="topic-growSensors"]' }));

  expect(onNoneTopicSensors).toHaveBeenCalledWith('growSensors');
});
