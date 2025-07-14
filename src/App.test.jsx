import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

test('renders NFT Monitoring App title', () => {
    render(<App />);
    expect(screen.getByText(/NFT Monitoring App/i)).toBeInTheDocument();
});
