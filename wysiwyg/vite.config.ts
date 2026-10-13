import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "lml-core": fileURLToPath(new URL("../src/layout-api.ts", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 15111,
    strictPort: true,
    fs: {
      allow: [".."],
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 15111,
    strictPort: true,
  },
});
