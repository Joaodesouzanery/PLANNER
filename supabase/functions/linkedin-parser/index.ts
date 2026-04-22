import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface ParseRequest {
  url?: string;
  text?: string;
}

interface ParsedProfile {
  name?: string;
  role?: string;
  company?: string;
  headline?: string;
  about?: string;
  raw?: string;
}

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

async function fetchPublicLinkedIn(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
    redirect: "follow",
  });
  const html = await resp.text();
  const head = html.slice(0, 30000);
  return head;
}

async function extractWithAI(content: string, hint: string): Promise<ParsedProfile> {
  const systemPrompt = `Você é um extrator de dados de perfis do LinkedIn. Extraia as seguintes informações do conteúdo fornecido:
- name (nome completo)
- role (cargo atual / título profissional)
- company (empresa atual)
- headline (headline/subtítulo do LinkedIn, se houver)
- about (resumo/sobre, se houver — máx 300 chars)

Responda APENAS com um JSON válido no formato:
{"name": "...", "role": "...", "company": "...", "headline": "...", "about": "..."}

Se um campo não for encontrado, omita-o ou use string vazia. Não invente dados.`;

  const userPrompt = `${hint}\n\n---\n\n${content.slice(0, 20000)}`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    const errTxt = await resp.text();
    throw new Error(`AI Gateway error ${resp.status}: ${errTxt}`);
  }

  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(text);
    return parsed as ParsedProfile;
  } catch {
    return { raw: text };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as ParseRequest;
    if (!body.url && !body.text) {
      return new Response(
        JSON.stringify({ error: "Forneça uma URL do LinkedIn ou um texto colado do perfil." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let content = "";
    let hint = "";

    if (body.url) {
      try {
        const u = new URL(body.url);
        if (!u.hostname.includes("linkedin.com")) {
          return new Response(
            JSON.stringify({ error: "A URL deve ser do linkedin.com" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch {
        return new Response(
          JSON.stringify({ error: "URL inválida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        content = await fetchPublicLinkedIn(body.url);
        hint = `Conteúdo HTML público do perfil ${body.url}. Extraia o que conseguir das tags <meta>, <title>, JSON-LD ou texto visível.`;
      } catch (e) {
        return new Response(
          JSON.stringify({
            error:
              "Não foi possível acessar a URL pública do LinkedIn (pode estar atrás de login). Cole o texto do perfil no campo 'Texto colado'.",
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (body.text) {
      content = body.text;
      hint = "Texto colado pelo usuário, capturado do perfil do LinkedIn.";
    }

    const parsed = await extractWithAI(content, hint);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    console.error("linkedin-parser error", e);
    return new Response(JSON.stringify({ error: e?.message || "Erro inesperado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
