import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/setupTests.js'],
    },
    resolve: {
        alias: {
            'react-router-dom': path.resolve(__dirname, 'src/compat/react-router-dom.js'),
        },
    },
});
