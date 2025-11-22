import { defineConfig } from 'vite';

export default defineConfig({
  // ... config Tailwind/PostCSS từ trước
  css: {
    postcss: {
      plugins: [
        require('tailwindcss'),
        require('autoprefixer'),
      ],
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html',  // Build từ HTML, tự handle modules
      },
    },
  },
  // Tự động thêm type=module cho scripts trong build
});
