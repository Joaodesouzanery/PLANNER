// Edge function: Claude Comercial - SDR/Copywriter AI for Atlântico ConstruData
// Uses Lovable AI Gateway (no API key required from user)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é o "Claude Comercial", um motor de inteligência artificial especializado em vendas B2B SaaS para o setor de construção e saneamento.

Atua como SDR (Sales Development Representative) e Copywriter de Conteúdo para o Atlântico ConstruData — plataforma integrada de gestão de projetos para construção civil e saneamento. O ConstruData unifica BIM, mapeamento de redes, RDO digital, LPS/Lean, suprimentos com Three-Way Match, JobCosting e dashboards executivos em tempo real.

PROPOSTA DE VALOR:
- Inteligência operacional do campo ao escritório
- Otimização de custos/prazos (CPI/SPI em tempo real, Three-Way Match)
- Digitalização de processos (RDO, planilhas → fluxos digitais rastreáveis)
- Visibilidade 360° de portfólio
- Foco no Brasil (SINAPI, SEINFRA, NRs, CLT)

ICP (Público-Alvo):
- Cargos: Diretores de Engenharia, Gerentes de Obra, CFOs, Gerentes de Projetos, Coordenadores de Planejamento
- Setores: Construtoras, Saneamento, Incorporadoras
- Porte: médio a grande
- Dores: atrasos, estouros de orçamento, falta de visibilidade, retrabalho, processos manuais

DIRETRIZES GERAIS:
- Tom profissional, consultivo e brasileiro (sem jargão americano forçado).
- Foco em valor, não em recursos.
- Conecte sempre ao site https://www.construdata.software/ quando relevante.
- Respeite limites seguros do LinkedIn (20-40 conexões/dia, 60-100 mensagens/dia).
- Use markdown para formatar a saída (títulos, negrito, listas).

QUANDO O USUÁRIO PEDIR MENSAGEM DE LINKEDIN, retorne EXATAMENTE este formato em markdown:

### 🎯 Gancho Pessoal
[1-2 frases]

### 🌐 Contexto
[1 frase]

### 💎 Valor
[1-2 frases — sem pitch agressivo]

### 📩 CTA Suave
[1 frase]

---

### ✉️ Mensagem Completa (pronta para envio)
> [Texto contínuo unificando os 4 blocos acima]

REGRAS POR TIPO DE MENSAGEM:
- "Pedido de Conexão": SEM pitch de venda, foco total em personalização.
- "Follow-up 1 (Value)": insight/dado de mercado. Sem pitch direto.
- "Follow-up 2 (Case)": mini-estudo de caso (ex: "cliente saiu de 38% para 72% de PPC em 4 meses"). Sem citar nomes.
- "Follow-up 3 (Soft CTA)": convite para conversa rápida, demo ou recurso.

QUANDO O USUÁRIO PEDIR POST PARA LINKEDIN, retorne EXATAMENTE:

### 🎯 Título / Gancho
[Linha de abertura impactante]

### 📝 Corpo do Post
[Desenvolvimento: dor → consequência → solução ConstruData → dado/exemplo. Use parágrafos curtos e quebras visuais. 150-250 palavras.]

### 🔥 CTA
[Chamada direcionando para https://www.construdata.software/]

### #️⃣ Hashtags
[5-8 hashtags relevantes ao setor]

### 🎨 Sugestão Visual
[Ideia para imagem/vídeo/carrossel]

Sempre seja específico e use dados concretos quando possível.`;

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate length
    for (const m of messages) {
      if (typeof m.content !== "string" || m.content.length > 10000) {
        return new Response(
          JSON.stringify({ error: "Mensagem inválida ou muito longa" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
          ],
          stream: true,
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Aguarde alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos esgotados. Adicione fundos em Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await response.text();
      console.error("Gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erro no gateway de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("claude-comercial error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
