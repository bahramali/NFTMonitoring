import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReportFiltersCompare from '../src/pages/Reports/components/ReportFiltersCompare.jsx';

test('topics determine which sensors are displayed', () => {
  const baseProps = {
    fromDate: '',
    toDate: '',
    onFromDateChange: () => {},
    onToDateChange: () => {},
    rangeLabel: '',
    catalog: { systems: [], devices: [] },
    topics: [
      { id: 'growSensors', label: 'Grow Sensors' },
      { id: 'waterTank', label: 'Water Tank' },
    ],
    topicSensors: {
      growSensors: [{ label: 'temperature' }, { label: 'humidity' }],
      waterTank: [{ label: 'ph' }],
    },
    selectedTopicSensors: {
      growSensors: ['temperature'],
    },
    selectedTopics: [],
  };

  const { rerender } = render(<ReportFiltersCompare {...baseProps} />);

  expect(screen.getByText(/choose a topic/i)).toBeInTheDocument();

  rerender(<ReportFiltersCompare {...baseProps} selectedTopics={['growSensors']} />);

  expect(screen.getAllByText('Grow Sensors').length).toBeGreaterThan(0);
  expect(screen.getByLabelText('temperature')).toBeChecked();
  expect(screen.queryByLabelText('ph')).not.toBeInTheDocument();

  rerender(<ReportFiltersCompare {...baseProps} selectedTopics={['waterTank']} />);

  expect(screen.getAllByText('Water Tank').length).toBeGreaterThan(0);
  expect(screen.getByLabelText('ph')).toBeInTheDocument();
  expect(screen.queryByLabelText('temperature')).not.toBeInTheDocument();
});

