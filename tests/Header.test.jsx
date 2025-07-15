import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Header from '../src/components/Header';

test('renders topic title', () => {
    render(<Header topic="my/topic" />);
    expect(screen.getByText('my/topic Dashboard')).toBeInTheDocument();
});
