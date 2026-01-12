import { defineConfig } from 'vite';

export default defineConfig({
    base: './', // Use relative paths for assets so it works on Itch.io / nested folders
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
    }
});
