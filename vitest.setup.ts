// Setup compartilhado. Roda para TODOS os testes (config única), então tudo que
// depende de DOM é carregado sob demanda — nos testes puros (`environment: node`)
// não existe `document` e importar jest-dom/stubs de jsdom quebraria a suíte.
if (typeof document !== "undefined") {
  await import("@testing-library/jest-dom/vitest");

  // jsdom não implementa algumas APIs que o Radix (shadcn Select) toca ao montar/interagir.
  // Stubs seguros para o render não quebrar no ambiente de teste.
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  if (!Element.prototype.hasPointerCapture) (Element.prototype as any).hasPointerCapture = () => false;
  if (!Element.prototype.releasePointerCapture) (Element.prototype as any).releasePointerCapture = () => {};
  if (!(globalThis as any).ResizeObserver) {
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
}
