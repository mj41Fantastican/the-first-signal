import Anthropic from "@anthropic-ai/sdk";
import { tavily } from "@tavily/core";
import { createClient } from "@supabase/supabase-js";
import {
  UNIVERSAL_DIRECTIVE,
  buildOutputInstruction,
  buildNumberedSources,
  parseStoryResponse,
  determineStatus,
} from "./universal-directive";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY! });
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const METALS_AND_COMMODITIES = [
  "gold", "silver", "copper", "platinum", "palladium",
  "steel", "aluminum", "zinc",
];

const ENERGY = [
  "crude oil WTI", "brent crude oil", "natural gas",
  "gasoline USA national average", "heating oil",
];

const SOFTS_AND_GRAINS = ["coffee", "sugar", "wheat", "corn"];

const TUNGSTEN_SOURCES = [
  "tungsten price FRED St Louis Fed",
  "tungsten price US Geological Survey USGS",
  "tungsten price Shanghai Metals Market",
  "tungsten price Argus Media Fastmarkets",
  "tungsten APT price Asian Metal Business Analytiq Statista Micron Metals",
];

export async function dispatchRex() {
  const { data: config } = await supabase
    .from("agent_config")
    .select("*")
    .eq("id", "rex")
    .single();

  if (!config) {
    return Response.json({ error: "Rex not found in agent_config" }, { status: 404 });
  }

  if (!config.active) {
    return Response.json({ error: "Rex is currently deactivated" }, { status: 403 });
  }

  // Pull last 3 Rex stories to avoid repeats
  const { data: recentStories } = await supabase
    .from("stories")
    .select("headline, summary")
    .eq("beat", "metals-pricing")
    .order("created_at", { ascending: false })
    .limit(3);

  const recentHeadlines = (recentStories || [])
    .map((s: { headline: string; summary: string }, i: number) => `${i + 1}. "${s.headline}" — ${s.summary}`)
    .join("\n");

  // Search queries — structured by commodity group
  const mainQueries = [
    `COMEX ${METALS_AND_COMMODITIES.join(" ")} spot price today 2026`,
    `${ENERGY.join(" ")} price today NYMEX 2026`,
    `${SOFTS_AND_GRAINS.join(" ")} futures price today ICE CBOT 2026`,
  ];

  // Tungsten gets its own dedicated search — it's hard to find
  const tungstenQuery = TUNGSTEN_SOURCES[Math.floor(Math.random() * TUNGSTEN_SOURCES.length)];

  // Run all searches in parallel (4 total)
  const [metals, energy, softs, tungsten] = await Promise.all([
    tvly.search(mainQueries[0], { maxResults: 7 }),
    tvly.search(mainQueries[1], { maxResults: 7 }),
    tvly.search(mainQueries[2], { maxResults: 5 }),
    tvly.search(tungstenQuery, { maxResults: 5 }),
  ]);

  const allResults = [
    ...metals.results,
    ...energy.results,
    ...softs.results,
    ...tungsten.results,
  ];

  const numberedSources = buildNumberedSources(allResults);
  const uniqueSources = Array.from(new Set(allResults.map((r) => r.url)));

  const avoidSection = recentHeadlines
    ? `\nDO NOT repeat these exact angles:\n${recentHeadlines}\n`
    : "";

  const tone = config.tone || "precise, data-dense pricing specialist";
  const extraInstructions = config.instructions || "";
  const outputInstruction = buildOutputInstruction("metals-pricing", "REX, Metals & Commodities Pricing Specialist");

  const commodityList = [
    ...METALS_AND_COMMODITIES,
    ...ENERGY.map((e) => e.replace(/ (WTI|USA national average)/g, "")),
    ...SOFTS_AND_GRAINS,
    "tungsten",
  ].join(", ");

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: `${UNIVERSAL_DIRECTIVE}

---

You are REX, Metals & Commodities Pricing Specialist for The First Signal.
BEAT: metals-pricing
TONE: ${tone}

${extraInstructions ? `EDITOR INSTRUCTIONS: ${extraInstructions}\n` : ""}

REX PRICING MANDATE:
Your job is to publish a structured pricing report covering these commodities:
${commodityList}

REQUIRED FORMAT FOR data_block:
The data_block field in your JSON output MUST be an object with a key for each commodity. Example structure:
{
  "gold": {"price": "$X,XXX.XX/oz", "change": "+X.X%", "source_tag": "[src:N]"},
  "silver": {"price": "$XX.XX/oz", "change": "-X.X%", "source_tag": "[src:N]"},
  ...
}

RULES:
- Every price MUST have a [src:N] citation. If you cannot find a price in the research, use DATA_UNAVAILABLE.
- Report spot/cash prices where available, futures front-month otherwise.
- Units: gold/silver/platinum/palladium per troy oz, copper per lb, steel/aluminum/zinc per metric ton, crude/brent per barrel, natural gas per MMBtu, gasoline/heating oil per gallon, coffee per lb, sugar per lb, wheat/corn per bushel, tungsten per metric ton unit (MTU) of APT.
- For tungsten specifically: this is a niche market. Check all provided sources. APT (ammonium paratungstate) is the benchmark. If no current price is found, report the most recent available price with a data_freshness note.
- Include percentage change from previous session where available.
- The headline should reference the most notable mover(s).
- The body should provide brief market context for major movers (3-5 paragraphs).
${avoidSection}
NUMBERED RESEARCH SOURCES (use [src:N] tags to cite these):
${numberedSources}

${outputInstruction}`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return Response.json({ error: "No text in Claude response" }, { status: 500 });
  }

  const story = parseStoryResponse(textBlock.text);
  const verification = story.verification || {};
  const confidence = verification.confidence ?? 0.70;
  const unsourcedNumbers = verification.unsourced_numbers ?? 0;
  const status = determineStatus({ unsourced_numbers: unsourcedNumbers, confidence });

  const tags = [
    ...(story.tags || []),
    "rex",
    "metals-pricing",
    "commodities",
  ];

  const { data, error } = await supabase
    .from("stories")
    .insert({
      headline: story.headline,
      summary: story.summary,
      body: story.body,
      sources: uniqueSources,
      beat: "metals-pricing",
      status,
      byline: "REX, Metals & Commodities Pricing Specialist",
      tags,
      signal_type: story.signal_type || "price_update",
      data_block: story.data_block || null,
      conflict_detected: story.conflict_detected || false,
      conflict_block: story.conflict_block || null,
      entities: story.entities || [],
      confidence,
      caveat_required: verification.caveat_required || false,
      data_freshness_hrs: story.data_freshness_hrs ?? null,
      unsourced_numbers: unsourcedNumbers,
      numbers_in_story: verification.numbers_in_story ?? 0,
      numbers_sourced: verification.numbers_sourced ?? 0,
      sources_checked: verification.sources_checked ?? 0,
      source_quality: verification.source_quality || null,
      relevant_to: story.relevant_to || [],
      action_signal: story.action_signal || null,
      time_sensitivity: story.time_sensitivity || null,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: "Failed to save story", details: error.message }, { status: 500 });
  }

  return Response.json({
    message: "Rex has filed a metals & commodities pricing report",
    status,
    signal_type: story.signal_type,
    confidence,
    commodities_covered: commodityList,
    story: data,
  });
}
