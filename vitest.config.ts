import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Config ÚNICA de testes (antes eram duas: node puro + render).
// - `.test.ts`  → lógica pura, roda em `node` (mais rápido, sem custo de jsdom)
// - `.test.tsx` → render React, roda em `jsdom`
// O alias "node:test" → "vitest" mantém os testes que usam a API do node:test
// funcionando sem reescrita; o resolver do vitest também cobre imports sem
// extensão e o alias "@/", que quebravam sob `node --test`.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "node:test": "vitest",
    },
  },
  test: {
    globals: true,
    environment: "node",
    environmentMatchGlobs: [["**/*.test.tsx", "jsdom"]],
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
