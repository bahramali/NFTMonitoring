/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,             // ✅ expect رو global میکنه
        environment: 'jsdom'       // ✅ برای اجرای React در DOM مجازی
    }
});
