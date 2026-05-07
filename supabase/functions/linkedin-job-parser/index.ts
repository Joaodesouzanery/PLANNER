const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  raw?: string;
}

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const cleanText = (value = "") =>
  value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const decodeHtml = (value = "") =>
  value
    .replace(/\\u003C/g, "<")
    .replace(/\\u003E/g, ">")
    .replace(/\\"/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

function extractJsonLd(html: string): ParsedJob {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(decodeHtml(match[1]).trim());
      const jobs = Array.isArray(parsed) ? parsed : [parsed];
      const job = jobs.find((item) => item?.["@type"] === "JobPosting" || item?.title || item?.description);
      if (job) {
        const location = Array.isArray(job.jobLocation) ? job.jobLocation[0] : job.jobLocation;
        const address = location?.address || {};
        return {
          companyName: job.hiringOrganization?.name || "",
          location: [address.addressLocality, address.addressRegion, address.addressCountry].filter(Boolean).join(", "),
          jobTitle: job.title || "",
          about: cleanText(decodeHtml(job.description || "")),
        };
      }
    } catch {
      // Continue to other scripts/fallbacks.
    }
  }
  return {};
}

function extractMeta(html: string): ParsedJob {
  const title = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] || "";
  const description =
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    "";

  const parts = decodeHtml(title).split("|").map((part) => part.trim()).filter(Boolean);
  return {
    jobTitle: parts[0] || "",
    companyName: parts[1] || "",
    about: cleanText(decodeHtml(description)),
  };
}

function heuristicFromText(text: string): ParsedJob {
  const normalized = cleanText(text);
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const aboutIndex = lines.findIndex((line) => /sobre a vaga|about the job|descri[cç][aã]o da vaga/i.test(line));
  const about = aboutIndex >= 0 ? lines.slice(aboutIndex + 1).join("\n").trim() : normalized;

  const companyLine = lines.find((line) => /^empresa[:\s]/i.test(line));
  const locationLine = lines.find((line) => /^localiza[cç][aã]o[:\s]|^local[:\s]/i.test(line));
  const titleLine = lines.find((line) => /^vaga[:\s]|^cargo[:\s]/i.test(line));

  return {
    companyName: companyLine?.replace(/^empresa[:\s]*/i, "") || "",
    location: locationLine?.replace(/^localiza[cç][aã]o[:\s]*|^local[:\s]*/i, "") || "",
    jobTitle: titleLine?.replace(/^vaga[:\s]*|^cargo[:\s]*/i, "") || "",
    about: about || normalized,
  };
}

async function fetchLinkedIn(url: string) {
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
    throw new Error(`LinkedIn retornou HTTP ${response.status}`);
  }

  return await response.text();
}

async function extractWithAI(content: string): Promise<ParsedJob> {
  if (!LOVABLE_API_KEY) return {};

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
            'Extraia dados de uma vaga do LinkedIn. Responda apenas JSON valido: {"companyName":"","location":"","jobTitle":"","about":""}. O campo about deve conter somente a secao "Sobre a vaga"/descricao, sem beneficios, rodape, links ou textos de interface quando possivel. Nao invente dados.',
        },
        { role: "user", content: content.slice(0, 20000) },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) return {};

  try {
    const data = await response.json();
    return JSON.parse(data.choices?.[0]?.message?.content || "{}") as ParsedJob;
  } catch {
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as ParseRequest;
    if (!body.url && !body.text) {
      return new Response(JSON.stringify({ error: "Informe uma URL do LinkedIn ou cole o texto da vaga." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let content = body.text || "";
    let parsed: ParsedJob = {};

    if (body.url) {
      const parsedUrl = new URL(body.url);
      if (!parsedUrl.hostname.includes("linkedin.com")) {
        return new Response(JSON.stringify({ error: "A URL deve ser do linkedin.com." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        content = await fetchLinkedIn(body.url);
        parsed = { ...extractMeta(content), ...extractJsonLd(content) };
      } catch (error) {
        if (!body.text) throw error;
        content = body.text;
        parsed = heuristicFromText(body.text);
      }
    } else if (body.text) {
      parsed = heuristicFromText(body.text);
    }

    const aiParsed = await extractWithAI(content);
    parsed = {
      companyName: aiParsed.companyName || parsed.companyName || "",
      location: aiParsed.location || parsed.location || "",
      jobTitle: aiParsed.jobTitle || parsed.jobTitle || "",
      about: aiParsed.about || parsed.about || "",
    };

    if (!parsed.about && content) {
      parsed.about = heuristicFromText(cleanText(content)).about;
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error:
          error?.message ||
          "Nao foi possivel ler a vaga. Cole o texto do LinkedIn no campo de texto e tente novamente.",
      }),
      { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
