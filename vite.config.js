import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  base: "/",
  plugins: [vue()],
  server: {
    proxy: {
      "/api/control": {
        target: process.env.VITE_CONTROL_PROXY_TARGET || "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
