import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Header from '../src/pages/common/Header';

test('renders header title', () => {
    render(<Header title="Reports" />);
    expect(screen.getByText('Reports')).toBeInTheDocument();
});
