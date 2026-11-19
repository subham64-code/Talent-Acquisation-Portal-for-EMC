import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 700,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        // Split heavy vendor libraries so they are cached independently of app code.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-router")) return "router";
          if (id.includes("@tanstack")) return "query";
          if (id.includes("axios")) return "http";
          if (id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler")) return "react";
          return "vendor";
        },
      },
    },
  },
});
