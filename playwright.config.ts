import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir: './tests/browser', workers: 1,
 use: { baseURL: 'http://127.0.0.1:4179/pwa-quest/', viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' },
 webServer: { env: { BASE_PATH: '/pwa-quest/' }, command: 'npm run preview -- --host 127.0.0.1 --port 4179 --strictPort', url: 'http://127.0.0.1:4179/pwa-quest/', reuseExistingServer: false },
});
