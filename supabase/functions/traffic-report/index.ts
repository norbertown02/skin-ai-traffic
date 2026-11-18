import { buildReport, periodFromRuns } from "./report.mjs";

const accountId = "2985215308420830";
const base = Deno.env.get("SUPABASE_URL")!;
const defaultKey = (variable: string) => JSON.parse(Deno.env.get(variable) || "{}").default;
const publicKey = defaultKey("SUPABASE_PUBLISHABLE_KEYS") || Deno.env.get("SUPABASE_ANON_KEY");
const adminKey = defaultKey("SUPABASE_SECRET_KEYS") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const originAllowed = (origin: string) =>
  /^https:\/\/skin-ai-traffic1(?:-[a-z0-9-]+-nutrialle-s-projects|-nutrialle-s-projects)?\.vercel\.app$/.test(origin) ||
  /^http:\/\/(localhost|127\.0\.0\.1):(4173|5173)$/.test(origin);

async function readAll(table: string, params: Record<string, string>) {
  const result = [];
  const pageSize = 1000;
  for (let offset = 0;; offset += pageSize) {
    const url = new URL("/rest/v1/" + table, base);
    url.search = new URLSearchParams({ ...params, limit: String(pageSize), offset: String(offset) }).toString();
    const headers = new Headers({ apikey: adminKey });
    if (!adminKey.startsWith("sb_secret_")) headers.set("Authorization", "Bearer " + adminKey);
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error("Database read failed for " + table + " (" + res.status + ")");
    const page = await res.json();
    if (!Array.isArray(page)) throw new Error("Invalid rows for " + table);
    result.push(...page);
    if (page.length < pageSize) return result;
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  });
  if (origin && originAllowed(origin)) headers.set("Access-Control-Allow-Origin", origin);
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers });
  if (origin && !originAllowed(origin)) return respond({ error: "Origem do relatório não autorizada." }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "GET") return respond({ error: "Método indisponível." }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return respond({ error: "unauthorized" }, 401);
  try {
    const result = await fetch(new URL("/auth/v1/user", base), {
      headers: { apikey: publicKey, Authorization: authorization }, signal: AbortSignal.timeout(8000),
    });
    if (result.status === 401 || result.status === 403) return respond({ error: "unauthorized" }, 401);
    if (!result.ok) return respond({ error: "A validação do acesso está temporariamente indisponível." }, 503);
    const user = await result.json();
    if (!user.id || user.app_metadata?.skin_report_account_id !== accountId) {
      return respond({ error: "Este usuário ainda não tem acesso ao relatório da Skin Beauty." }, 403);
    }

    const params = new URL(req.url).searchParams;
    const eq = "eq." + accountId;
    const runs = await readAll("sync_runs", {
      select: "stream,date_from,date_to", source_id: "eq.meta", scope_id: eq, status: "eq.succeeded",
      order: "date_from.asc,id.asc",
    });
    const period = periodFromRuns(runs, params);
    if (!period) return respond({ error: "Ainda não há histórico de anúncios sincronizado." }, 404);

    const dates = { account_id: eq, and: "(date.gte." + period.start + ",date.lte." + period.end + ")" };
    const baseMetrics = "ad_id,spend,impressions,clicks,link_clicks,purchases,revenue";
    const [daily, placements, audience, ads, sets, campaigns, creatives, monthly, business] = await Promise.all([
      readAll("ad_metrics_daily", { ...dates, order:"date.asc,ad_id.asc",
        select:baseMetrics+",date,landing_page_views,add_to_cart,checkouts,video_plays,video_25,video_50,video_75,video_95,video_100" }),
      readAll("ad_delivery_metrics_daily", { ...dates, order:"date.asc,ad_id.asc,publisher_platform.asc,platform_position.asc",
        select:baseMetrics+",publisher_platform,platform_position" }),
      readAll("ad_audience_metrics_daily", { ...dates, order:"date.asc,ad_id.asc,breakdown.asc,age.asc,gender.asc,region.asc",
        select:"spend,impressions,clicks,link_clicks,purchases,revenue,breakdown,age,gender,region" }),
      readAll("ads", { account_id:eq, order:"id.asc", select:"id,name,campaign_id,ad_set_id,creative_id,effective_status" }),
      readAll("ad_sets", { account_id:eq, order:"id.asc", select:"id,name,audience_type,targeting,effective_status" }),
      readAll("campaigns", { account_id:eq, order:"id.asc", select:"id,name,effective_status" }),
      readAll("creatives", { account_id:eq, order:"id.asc", select:"id,name,headline,primary_text,image_url,thumbnail_url,video_id" }),
      readAll("traffic_management_monthly", { account_id:eq, order:"month_start.asc", select:"*" }),
      readAll("traffic_business_monthly", { account_id:eq, order:"month_start.asc,shop_domain.asc", select:"*" }),
    ]);

    return respond(buildReport({ daily, placements, audience, ads, sets, campaigns, creatives, monthly, business }, period));
  } catch (error) {
    if (error instanceof RangeError) return respond({ error: error.message }, 400);
    console.error(error instanceof Error ? error.message : "skin_report_failed");
    return respond({ error: "Não foi possível carregar os dados do relatório." }, 503);
  }
});
