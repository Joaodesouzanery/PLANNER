import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Config de teste de RENDER (React). Separado do `npm test` (node:test puro, .test.ts):
// aqui só rodam os `.test.tsx` em jsdom — o `include` evita colidir com os testes puros.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.tsx"],
  },
});
