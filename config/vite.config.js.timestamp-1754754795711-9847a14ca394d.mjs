// config/vite.config.js
import { defineConfig } from "file:///Users/morganzysman/Downloads/uwebsockets-demo/dashboard/node_modules/vite/dist/node/index.js";
import vue from "file:///Users/morganzysman/Downloads/uwebsockets-demo/dashboard/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import { resolve } from "path";
import tailwindcss from "file:///Users/morganzysman/Downloads/uwebsockets-demo/dashboard/node_modules/tailwindcss/lib/index.js";
import autoprefixer from "file:///Users/morganzysman/Downloads/uwebsockets-demo/dashboard/node_modules/autoprefixer/lib/autoprefixer.js";
var __vite_injected_original_dirname = "/Users/morganzysman/Downloads/uwebsockets-demo/dashboard/config";
var vite_config_default = defineConfig({
  plugins: [vue()],
  root: resolve(__vite_injected_original_dirname, "../client"),
  resolve: {
    alias: {
      "@": resolve(__vite_injected_original_dirname, "../client/src")
    }
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss({
          config: resolve(__vite_injected_original_dirname, "./tailwind.config.js")
        }),
        autoprefixer()
      ]
    }
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
    // Bind to all interfaces for Docker
    hmr: {
      host: "localhost",
      // Use localhost for browser HMR connection
      port: 5173
    },
    watch: {
      usePolling: true
    },
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false
      },
      "/health": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false
      },
      "/ping": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: "../dist",
    assetsDir: "assets"
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiY29uZmlnL3ZpdGUuY29uZmlnLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL21vcmdhbnp5c21hbi9Eb3dubG9hZHMvdXdlYnNvY2tldHMtZGVtby9kYXNoYm9hcmQvY29uZmlnXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvbW9yZ2FuenlzbWFuL0Rvd25sb2Fkcy91d2Vic29ja2V0cy1kZW1vL2Rhc2hib2FyZC9jb25maWcvdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL21vcmdhbnp5c21hbi9Eb3dubG9hZHMvdXdlYnNvY2tldHMtZGVtby9kYXNoYm9hcmQvY29uZmlnL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcbmltcG9ydCB2dWUgZnJvbSAnQHZpdGVqcy9wbHVnaW4tdnVlJ1xuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ3BhdGgnXG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSAndGFpbHdpbmRjc3MnXG5pbXBvcnQgYXV0b3ByZWZpeGVyIGZyb20gJ2F1dG9wcmVmaXhlcidcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3Z1ZSgpXSxcbiAgcm9vdDogcmVzb2x2ZShfX2Rpcm5hbWUsICcuLi9jbGllbnQnKSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAnQCc6IHJlc29sdmUoX19kaXJuYW1lLCAnLi4vY2xpZW50L3NyYycpXG4gICAgfVxuICB9LFxuICBjc3M6IHtcbiAgICBwb3N0Y3NzOiB7XG4gICAgICBwbHVnaW5zOiBbXG4gICAgICAgIHRhaWx3aW5kY3NzKHtcbiAgICAgICAgICBjb25maWc6IHJlc29sdmUoX19kaXJuYW1lLCAnLi90YWlsd2luZC5jb25maWcuanMnKVxuICAgICAgICB9KSxcbiAgICAgICAgYXV0b3ByZWZpeGVyKClcbiAgICAgIF1cbiAgICB9XG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDUxNzMsXG4gICAgaG9zdDogJzAuMC4wLjAnLCAvLyBCaW5kIHRvIGFsbCBpbnRlcmZhY2VzIGZvciBEb2NrZXJcbiAgICBobXI6IHtcbiAgICAgIGhvc3Q6ICdsb2NhbGhvc3QnLCAvLyBVc2UgbG9jYWxob3N0IGZvciBicm93c2VyIEhNUiBjb25uZWN0aW9uXG4gICAgICBwb3J0OiA1MTczLFxuICAgIH0sXG4gICAgd2F0Y2g6IHtcbiAgICAgIHVzZVBvbGxpbmc6IHRydWUsXG4gICAgfSxcbiAgICBwcm94eToge1xuICAgICAgJy9hcGknOiB7XG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMScsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgc2VjdXJlOiBmYWxzZVxuICAgICAgfSxcbiAgICAgICcvaGVhbHRoJzoge1xuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjMwMDEnLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHNlY3VyZTogZmFsc2VcbiAgICAgIH0sXG4gICAgICAnL3BpbmcnOiB7XG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMScsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgc2VjdXJlOiBmYWxzZVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6ICcuLi9kaXN0JyxcbiAgICBhc3NldHNEaXI6ICdhc3NldHMnXG4gIH1cbn0pICJdLAogICJtYXBwaW5ncyI6ICI7QUFBK1csU0FBUyxvQkFBb0I7QUFDNVksT0FBTyxTQUFTO0FBQ2hCLFNBQVMsZUFBZTtBQUN4QixPQUFPLGlCQUFpQjtBQUN4QixPQUFPLGtCQUFrQjtBQUp6QixJQUFNLG1DQUFtQztBQU16QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsSUFBSSxDQUFDO0FBQUEsRUFDZixNQUFNLFFBQVEsa0NBQVcsV0FBVztBQUFBLEVBQ3BDLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssUUFBUSxrQ0FBVyxlQUFlO0FBQUEsSUFDekM7QUFBQSxFQUNGO0FBQUEsRUFDQSxLQUFLO0FBQUEsSUFDSCxTQUFTO0FBQUEsTUFDUCxTQUFTO0FBQUEsUUFDUCxZQUFZO0FBQUEsVUFDVixRQUFRLFFBQVEsa0NBQVcsc0JBQXNCO0FBQUEsUUFDbkQsQ0FBQztBQUFBLFFBQ0QsYUFBYTtBQUFBLE1BQ2Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBO0FBQUEsSUFDTixLQUFLO0FBQUEsTUFDSCxNQUFNO0FBQUE7QUFBQSxNQUNOLE1BQU07QUFBQSxJQUNSO0FBQUEsSUFDQSxPQUFPO0FBQUEsTUFDTCxZQUFZO0FBQUEsSUFDZDtBQUFBLElBQ0EsT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLFFBQ04sUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsUUFBUTtBQUFBLE1BQ1Y7QUFBQSxNQUNBLFdBQVc7QUFBQSxRQUNULFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLFFBQVE7QUFBQSxNQUNWO0FBQUEsTUFDQSxTQUFTO0FBQUEsUUFDUCxRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsUUFDZCxRQUFRO0FBQUEsTUFDVjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixXQUFXO0FBQUEsRUFDYjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
