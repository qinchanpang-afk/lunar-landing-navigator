import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// NASA JPL Horizons sends no CORS headers: proxy it same-origin for custom-coordinate sites.
// Production hosts need the equivalent rewrite (see public/_redirects for Netlify, vercel.json for Vercel).
const horizonsProxy = {
  "/api/horizons": {
    target: "https://ssd.jpl.nasa.gov",
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/api\/horizons/, "/api/horizons.api"),
  },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: horizonsProxy },
  preview: { proxy: horizonsProxy },
  build: {
    // Recharts alone is ~560 kB minified (158 kB gzip); it is split into its own long-cacheable vendor chunk.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: { manualChunks: { charts: ["recharts"] } },
    },
  },
});
