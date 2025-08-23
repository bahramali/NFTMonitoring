import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/setupTests.js'],
        // Run tests sequentially in a single thread to reduce memory usage
        threads: false,
    },
    resolve: {
        alias: {
        },
    },
});
