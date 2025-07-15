/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        // Include the mock so tests have a ResizeObserver implementation.
        setupFiles: ['./__mocks__/resizeObserver.js']
    }
});
