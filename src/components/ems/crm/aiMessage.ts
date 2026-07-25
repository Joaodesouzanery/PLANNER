// Helper de IA do CRM: chama a edge function claude-comercial (streaming SSE) via fetch cru.
// A função supabase.functions.invoke NÃO consegue consumir o stream — por isso fetch manual,
// mesmo padrão de ComercialAutomatizado.tsx (callAI). Acumula os deltas e devolve o texto final.

export interface AiMsg { role: "user" | "assistant" | "system"; content: string }

/** Chama claude-comercial e streama os deltas via onDelta; resolve com o texto completo. */
export const streamComercialAI = async (messages: AiMsg[], onDelta?: (chunk: string) => void): Promise<string> => {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claude-comercial`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (resp.status === 429) throw new Error("Limite de requisições atingido. Aguarde um momento.");
  if (resp.status === 402) throw new Error("Créditos de IA esgotados (Settings → Workspace → Usage).");
  if (!resp.ok || !resp.body) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`Erro ao conectar com a IA: ${txt || resp.status}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let acc = "";
  let done = false;
  while (!done) {
    const { done: streamDone, value } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { done = true; break; }
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) { acc += content; onDelta?.(content); }
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }
  return acc;
};
