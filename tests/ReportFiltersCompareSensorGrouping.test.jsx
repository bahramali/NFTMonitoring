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
  topics: [{ id: 'growSensors', label: 'Grow Sensors' }],
  topicSensors: {
    growSensors: [
      { label: '405nm' },
      { label: '425nm' },
      { label: '475nm' },
      { label: '640nm' },
    ],
  },
  selectedTopics: ['growSensors'],
};

test('renders grouped sensor options and toggles the whole group', () => {
  const onToggleTopicSensor = vi.fn();
  render(
    <ReportFiltersCompare
      {...baseProps}
      selectedTopicSensors={{ growSensors: [] }}
      onToggleTopicSensor={onToggleTopicSensor}
    />
  );

  expect(screen.queryByLabelText('405nm')).not.toBeInTheDocument();
  expect(screen.getAllByLabelText('blue light')).toHaveLength(1);

  fireEvent.click(screen.getByLabelText('blue light'));

  expect(onToggleTopicSensor).toHaveBeenCalledTimes(1);
  const payload = onToggleTopicSensor.mock.calls[0][1];
  expect(payload).toMatchObject({ type: 'group', shouldSelect: true });
  expect(payload.values).toEqual(['405nm', '425nm', '450nm', '475nm', '515nm']);
});

test('group checkbox requests removal when already fully selected', () => {
  const onToggleTopicSensor = vi.fn();
  render(
    <ReportFiltersCompare
      {...baseProps}
      selectedTopicSensors={{
        growSensors: ['405nm', '425nm', '450nm', '475nm', '515nm'],
      }}
      onToggleTopicSensor={onToggleTopicSensor}
    />
  );

  fireEvent.click(screen.getByLabelText('blue light'));

  const payload = onToggleTopicSensor.mock.calls[0][1];
  expect(payload).toMatchObject({ type: 'group', shouldSelect: false });
});
