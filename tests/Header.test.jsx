import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Header from '../src/components/Header';

test('renders system title', () => {
    render(<Header system="S01" />);
    expect(screen.getByText('S01 Dashboard')).toBeInTheDocument();
});
