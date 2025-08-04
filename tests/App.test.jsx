import React from 'react';
import { render} from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../src/App';

test('renders App component', () => {
    const { container } = render(<App />);
    expect(container).toBeDefined();
});
