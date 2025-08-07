import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
    base: './',
    plugins: [react()],
    resolve: {
        alias: {
            'react-router-dom': path.resolve(__dirname, 'src/compat/react-router-dom.jsx'),
        },
    },
});
