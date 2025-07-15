import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Header from '../src/components/Header';

test('shows sensor status labels', () => {
    const health = { veml7700: true, as7341: false };
    render(<Header topic="t" temperature={20} lux={50} health={health} />);
    expect(screen.getByText('veml7700')).toBeInTheDocument();
    expect(screen.getByText('as7341')).toBeInTheDocument();
});
