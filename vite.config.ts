import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Tauri が開発サーバーを 1420 番で待つため、ポートを固定する。
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
});
