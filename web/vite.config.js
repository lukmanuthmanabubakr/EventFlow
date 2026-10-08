import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The two backend services do not send CORS headers, so the browser would
// block a direct call from this page to ports 5004/5005. Instead the dev
// server proxies those calls for us: the browser only ever talks to 5173.
//
// 127.0.0.1 is deliberate. "localhost" resolves to IPv6 (::1) on this
// machine, which the services do not listen on, and that shows up as a
// connection reset rather than a clear error.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/order-api": {
        target: "http://127.0.0.1:5004",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/order-api/, ""),
      },
      "/inventory-api": {
        target: "http://127.0.0.1:5005",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/inventory-api/, ""),
      },
    },
  },
});
