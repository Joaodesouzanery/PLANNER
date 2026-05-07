const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ParseRequest {
  url?: string;
  text?: string;
}

interface ParsedJob {
  companyName?: string;
  location?: string;
  jobTitle?: string;
  about?: string;
}

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const decodeHtml = (value = "") =>
  value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

// Convert HTML to readable plain text preserving line breaks for <br> and </p>/<li>
const htmlToText = (html = "") => {
  const replaced = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|h[1-6]|div)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "");
  return decodeHtml(replaced)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
};

const cleanInline = (value = "") =>
  decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

function extractJobIdFromUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    // /jobs/view/4383487407/  OR /jobs/view/some-title-4383487407
    const m = u.pathname.match(/\/jobs\/view\/([^/?#]+)/i);
    if (m) {
      const tail = m[1];
      const id = tail.match(/(\d{6,})/)?.[1];
      if (id) return id;
    }
    const fromQuery = u.searchParams.get("currentJobId");
    if (fromQuery && /^\d+$/.test(fromQuery)) return fromQuery;
    return null;
  } catch {
    return null;
  }
}

async function fetchGuestJobPosting(jobId: string) {
  const url = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`LinkedIn jobs-guest retornou HTTP ${response.status}`);
  }
  return await response.text();
}

function parseGuestPosting(html: string): ParsedJob {
  // Title
  const titleMatch =
    html.match(/<h2[^>]*class="[^"]*top-card-layout__title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i) ||
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const jobTitle = cleanInline(titleMatch?.[1] || "");

  // Company
  const companyMatch =
    html.match(/<a[^>]*class="[^"]*topcard__org-name-link[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ||
    html.match(/<span[^>]*class="[^"]*topcard__flavor[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
  const companyName = cleanInline(companyMatch?.[1] || "");

  // Location
  const locationMatch = html.match(
    /<span[^>]*class="[^"]*topcard__flavor[^"]*topcard__flavor--bullet[^"]*"[^>]*>([\s\S]*?)<\/span>/i
  ) || html.match(
    /<div[^>]*class="[^"]*sub-nav-cta__meta-text[^"]*"[^>]*>([\s\S]*?)<\/div>/i
  );
  const location = cleanInline(locationMatch?.[1] || "");

  // Description (full body!)
  const descMatch =
    html.match(
      /<div[^>]*class="[^"]*show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    ) ||
    html.match(
      /<section[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/section>/i
    );
  const about = htmlToText(descMatch?.[1] || "");

  return { jobTitle, companyName, location, about };
}

function extractJsonLd(html: string): ParsedJob {
  const scripts = [
    ...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const job = items.find(
        (item) => item?.["@type"] === "JobPosting" || item?.title || item?.description
      );
      if (job) {
        const loc = Array.isArray(job.jobLocation) ? job.jobLocation[0] : job.jobLocation;
        const address = loc?.address || {};
        return {
          companyName: job.hiringOrganization?.name || "",
          location: [address.addressLocality, address.addressRegion, address.addressCountry]
            .filter(Boolean)
            .join(", "),
          jobTitle: job.title || "",
          about: htmlToText(job.description || ""),
        };
      }
    } catch {
      // continue
    }
  }
  return {};
}

function heuristicFromText(text: string): ParsedJob {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const aboutIndex = lines.findIndex((line) =>
    /sobre a vaga|about the job|descri[cç][aã]o da vaga/i.test(line)
  );
  const about = aboutIndex >= 0 ? lines.slice(aboutIndex + 1).join("\n").trim() : text.trim();
  return {
    companyName: lines.find((l) => /^empresa[:\s]/i.test(l))?.replace(/^empresa[:\s]*/i, "") || "",
    location:
      lines.find((l) => /^localiza[cç][aã]o[:\s]|^local[:\s]/i.test(l))?.replace(
        /^localiza[cç][aã]o[:\s]*|^local[:\s]*/i,
        ""
      ) || "",
    jobTitle: lines.find((l) => /^vaga[:\s]|^cargo[:\s]/i.test(l))?.replace(/^vaga[:\s]*|^cargo[:\s]*/i, "") || "",
    about,
  };
}

async function refineWithAI(rawAbout: string, base: ParsedJob): Promise<ParsedJob> {
  if (!LOVABLE_API_KEY || !rawAbout) return base;
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              'Voce recebe a descricao bruta de uma vaga do LinkedIn (ja em texto puro). Devolva APENAS um JSON valido no formato {"about":"..."}. O campo about deve conter a secao "Sobre a vaga" / responsabilidades / requisitos COMPLETA, preservando bullets com - no inicio. Remova rodape, beneficios, links e textos de interface. NUNCA invente, apenas reorganize o que foi recebido.',
          },
          { role: "user", content: rawAbout.slice(0, 30000) },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!response.ok) return base;
    const data = await response.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    if (parsed.about && parsed.about.length >= rawAbout.length * 0.5) {
      return { ...base, about: parsed.about };
    }
    return base;
  } catch {
    return base;
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
        JSON.stringify({ error: "Informe uma URL do LinkedIn ou cole o texto da vaga." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsed: ParsedJob = {};

    if (body.url) {
      const u = new URL(body.url);
      if (!u.hostname.includes("linkedin.com")) {
        return new Response(JSON.stringify({ error: "A URL deve ser do linkedin.com." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const jobId = extractJobIdFromUrl(body.url);
      if (jobId) {
        try {
          const html = await fetchGuestJobPosting(jobId);
          parsed = parseGuestPosting(html);
          // fall back to ld+json if guest page didnt have description
          if (!parsed.about) {
            const ld = extractJsonLd(html);
            parsed = {
              companyName: parsed.companyName || ld.companyName,
              location: parsed.location || ld.location,
              jobTitle: parsed.jobTitle || ld.jobTitle,
              about: parsed.about || ld.about,
            };
          }
        } catch (err) {
          if (!body.text) throw err;
        }
      }
    }

    if (!parsed.about && body.text) {
      parsed = { ...heuristicFromText(body.text), ...parsed };
    }

    // AI refine to clean noise but keep full content
    if (parsed.about) {
      parsed = await refineWithAI(parsed.about, parsed);
    }

    if (!parsed.about && !parsed.jobTitle && !parsed.companyName) {
      return new Response(
        JSON.stringify({
          error:
            "Nao foi possivel ler a vaga pela URL. Cole o texto da vaga no campo de apoio e tente novamente.",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("linkedin-job-parser error:", error?.message);
    return new Response(
      JSON.stringify({
        error: error?.message || "Erro inesperado ao ler a vaga.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
