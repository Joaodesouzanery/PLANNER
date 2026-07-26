import { defineConfig } from "vitest/config";
import path from "path";

// Testes PUROS (lógica, sem DOM). Rodam em vitest/node em vez de `node --test`:
// o resolver do vitest entende imports sem extensão e o alias "@/", que era a causa
// dos ERR_MODULE_NOT_FOUND quando um módulo importava outro módulo do app.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "node:test": "vitest",
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
  },
});
