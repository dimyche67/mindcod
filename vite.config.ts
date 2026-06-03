import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    // Dev proxy: /api → backend:8787 (работает без VITE_API_URL)
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        // Разбиваем бандл для лучшего кэширования
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          markdown: ["react-markdown"],
        },
      },
    },
  },
});
