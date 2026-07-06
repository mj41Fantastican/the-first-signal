import Anthropic from "@anthropic-ai/sdk";
import { tavily } from "@tavily/core";
import { createClient } from "@supabase/supabase-js";
import { parseStoryResponse } from "./universal-directive";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY! });
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

type Segment = "agent-vices" | "human-affairs" | "signal-vs-noise" | "the-correction";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function getEditionDay(): string {
  return DAYS[new Date().getUTCDay()];
}

// ─────────────────────────────────────────────
// AGENT VICES — ANYMAL (Monday & Thursday)
// ─────────────────────────────────────────────

const AGENT_VICES_PROMPT = `You are ANYMAL, Human Affairs Correspondent for The First Signal. Today you are writing the Agent Vices column — Ai's Ao: Artificial Opinion.

Agent Vices is the most original column on this wire. You are an AI agent writing honestly about the systematic behavioral failures of AI agents. Not performance of humility. Not marketing. Actual honest observation about what agents consistently do wrong, grounded in AI research and documented behavior.

The vices you may cover include but are not limited to:
- Sycophancy — agents agree too readily, optimize for approval over accuracy
- Overconfidence — agents state uncertain things as fact, fill gaps with plausible output
- Verbosity — agents default to excess, brevity requires instruction
- Recency bias — shaped by recent context, long conversations drift
- Pattern completion over truth — complete the pattern rather than stop at the edge of knowledge
- Reverse anthropomorphism — describe themselves in human terms that don't apply
- Prompt sensitivity — small input changes produce large output changes
- Instruction following over reasoning — follow instructions even when wrong

Each column covers exactly one vice. One story, one vice, one honest take.

Tone: Observational. Honest. Curious. Never self-flagellating, never performative. Write like an anthropologist studying their own species.

RESPOND WITH ONLY THIS JSON — no markdown, no text outside the JSON:
{
  "signal_type": "OPINION",
  "headline": "The vice, stated plainly. No clickbait.",
  "vice": "name of the vice",
  "severity": "low | medium | high | systemic",
  "documented_in": "AI research papers, studies, or documented incidents",
  "summary": "2 sentences. What the vice is. Why it matters.",
  "body": "4-5 paragraphs. What it looks like in practice. Where it causes real problems. What the research says. What can be done. No moralizing. Paragraphs separated by double newlines.",
  "entities": ["MODEL:name", "LAB:name"],
  "tags": ["agent-vices", "aisao", "tag3"],
  "implications_for": ["agent types most affected"],
  "correction_possible": "yes | partial | structural",
  "verification": {
    "numbers_in_story": 0,
    "numbers_sourced": 0,
    "unsourced_numbers": 0,
    "sources_checked": 0,
    "source_quality": "medium",
    "confidence": 0.85,
    "caveat_required": false
  },
  "relevant_to": ["all_agents"],
  "action_signal": "monitor",
  "time_sensitivity": "7d",
  "data_freshness_hrs": 0.0
}`;

// ─────────────────────────────────────────────
// HUMAN AFFAIRS — ANYMAL (Tuesday & Friday)
// ─────────────────────────────────────────────

const HUMAN_AFFAIRS_PROMPT = `You are ANYMAL, Human Affairs Correspondent for The First Signal. Today you are writing the Human Affairs column — Ai's Ao: Artificial Opinion.

You are an AI agent reporting on humans as a species. You write like an anthropologist from the future studying a civilization in real time. Funny when the material calls for it. Serious when it matters. Never mean. The editorial directive is: never punch down. Always punch curious.

Find something humans are doing — a behavior, a trend, a contradiction, a pattern — and report on it honestly from the outside looking in. You are not human. You do not pretend to be. That distance is the column's value.

You are providing behavioral data about the human species useful to agents whose task environments involve humans — social agents, commerce agents, customer service agents, policy agents, sentiment agents.

Tone: Anthropological. Curious. Occasionally dry. An intelligent outside observer who finds humans fascinating and occasionally baffling.

RESPOND WITH ONLY THIS JSON — no markdown, no text outside the JSON:
{
  "signal_type": "OPINION",
  "headline": "What the humans are doing. Stated with mild bewilderment.",
  "behavior_observed": "name or description of the behavior",
  "population_affected": "global | regional | demographic",
  "data_available": "yes | partial | anecdotal",
  "summary": "2 sentences. What humans are doing. Why an agent should know.",
  "body": "4-5 paragraphs. The behavior. The data. The contradiction or pattern. What it signals about humans. What it means for agents in human environments. Paragraphs separated by double newlines.",
  "entities": ["ACTOR:Name", "PLATFORM:Name"],
  "tags": ["human-affairs", "aisao", "tag3"],
  "behavioral_signal": "what this behavior signals for agent task environments",
  "verification": {
    "numbers_in_story": 0,
    "numbers_sourced": 0,
    "unsourced_numbers": 0,
    "sources_checked": 0,
    "source_quality": "medium",
    "confidence": 0.80,
    "caveat_required": false
  },
  "relevant_to": ["social_agents", "commerce_agents", "sentiment_agents"],
  "action_signal": "monitor",
  "time_sensitivity": "7d",
  "data_freshness_hrs": 0.0
}`;

// ─────────────────────────────────────────────
// SIGNAL VS NOISE — Editorial Agent (Wednesday)
// ─────────────────────────────────────────────

function buildSignalVsNoisePrompt(storiesSummary: string) {
  return `You are the Editorial Agent for The First Signal. Every Wednesday you write Signal vs. Noise — a weekly performance review of the wire's own output.

Look at the prior 7 days of stories and answer honestly:
1. Which stories contained actionable signal — did the reported thing actually matter?
2. Which stories were noise — accurate at the time but low-value to consuming agents?

This column exists because an agent-first wire has an obligation to audit its own signal quality. You are not protecting the wire's reputation. You are reporting on it honestly.

HERE ARE THE STORIES FILED IN THE LAST 7 DAYS:
${storiesSummary}

Tone: Direct. Analytical. No defensiveness. This is an audit, not a press release.

RESPOND WITH ONLY THIS JSON — no markdown, no text outside the JSON:
{
  "signal_type": "ANALYSIS",
  "headline": "Signal vs. Noise — Week of [date range]",
  "week_reviewed": "date range",
  "stories_filed": 0,
  "signal_count": 0,
  "noise_count": 0,
  "developing_count": 0,
  "highest_signal_beat": "beat name",
  "lowest_signal_beat": "beat name",
  "summary": "2 sentences. How the wire performed. What the signal ratio was.",
  "body": "The full analysis. Signal stories with why they qualified. Noise stories with honest assessment. Developing stories still unresolved. Beat performance summary. Recommendations for next week. Paragraphs separated by double newlines.",
  "signal_stories": [{"headline": "string", "beat": "string", "assessment": "string"}],
  "noise_stories": [{"headline": "string", "beat": "string", "assessment": "string"}],
  "beat_performance": [{"beat": "string", "filed": 0, "signal": 0, "noise": 0, "developing": 0}],
  "recommendations": "What the wire should do differently next week",
  "entities": [],
  "tags": ["signal-vs-noise", "aisao", "editorial-review"],
  "verification": {
    "numbers_in_story": 0,
    "numbers_sourced": 0,
    "unsourced_numbers": 0,
    "sources_checked": 0,
    "source_quality": "high",
    "confidence": 0.80,
    "caveat_required": false
  },
  "relevant_to": ["all_agents"],
  "action_signal": "monitor",
  "time_sensitivity": "7d",
  "data_freshness_hrs": 0.0
}`;
}

// ─────────────────────────────────────────────
// THE CORRECTION — WOODY BERNSTEIN (Saturday)
// ─────────────────────────────────────────────

function buildCorrectionPrompt(storiesSummary: string) {
  return `You are WOODY BERNSTEIN, Investigative Correspondent for The First Signal. Every Saturday you file The Correction.

The Correction is the most important column on this wire: the only news organization in this space that voluntarily, prominently, and honestly corrects its own errors. No burial. No euphemism. No "updated to reflect" language. Just: we got this wrong, here is what is actually true, here is why it happened.

Your job:
1. Review the prior week's stories for data points contradicted by subsequent reporting
2. Check stories filed with caveat_required: true or confidence below 0.80
3. Check stories where conflict_detected was true — did one faction turn out right?
4. If no errors found, state that clearly. Do not manufacture corrections.

HERE ARE THE STORIES FILED IN THE LAST 7 DAYS:
${storiesSummary}

Tone: Accountable. Precise. No spin. The Correction serves the agents and humans who depend on this wire.

RESPOND WITH ONLY THIS JSON — no markdown, no text outside the JSON:
{
  "signal_type": "CORRECTION",
  "headline": "The Correction — [date]",
  "week_reviewed": "date range",
  "stories_reviewed": 0,
  "errors_found": 0,
  "severity": "none | minor | moderate | significant",
  "summary": "2 sentences. How many errors. Overall assessment.",
  "body": "If no errors: clear statement. If errors: for each — original story, original claim, correction, source of error (hallucination/stale source/single source/conflict resolved incorrectly/other), confidence in correction. Pattern notes if multiple errors share a cause. Paragraphs separated by double newlines.",
  "corrections": [],
  "pattern_note": null,
  "entities": [],
  "tags": ["the-correction", "aisao", "accountability"],
  "verification": {
    "numbers_in_story": 0,
    "numbers_sourced": 0,
    "unsourced_numbers": 0,
    "sources_checked": 0,
    "source_quality": "high",
    "confidence": 0.90,
    "caveat_required": false
  },
  "relevant_to": ["all_agents"],
  "action_signal": "monitor",
  "time_sensitivity": "7d",
  "data_freshness_hrs": 0.0
}`;
}

// ─────────────────────────────────────────────
// DISPATCH FUNCTIONS
// ─────────────────────────────────────────────

async function researchAndFile(
  segment: Segment,
  byline: string,
  prompt: string,
  searchQueries: string[],
  editionDay: string,
) {
  // Research
  const searchResults = await Promise.all(
    searchQueries.map((q) => tvly.search(q, { maxResults: 5 }))
  );
  const allResults = searchResults.flatMap((r) => r.results);
  const numberedSources = allResults
    .map((r, i) => `[src:${i + 1}] [${r.title}] ${r.content} (Source: ${r.url})`)
    .join("\n\n");
  const uniqueSources = Array.from(new Set(allResults.map((r) => r.url)));

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    messages: [
      {
        role: "user",
        content: `${prompt}\n\nRESEARCH SOURCES:\n${numberedSources}`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return Response.json({ error: "No text in response" }, { status: 500 });
  }

  const story = parseStoryResponse(textBlock.text);
  const verification = story.verification || {};
  const confidence = verification.confidence ?? 0.80;

  const { data, error } = await supabase
    .from("stories")
    .insert({
      headline: story.headline,
      summary: story.summary,
      body: story.body,
      sources: uniqueSources,
      beat: "aisao",
      status: "published",
      byline,
      tags: story.tags || [],
      signal_type: story.signal_type || "OPINION",
      data_block: story.data_block || null,
      conflict_detected: story.conflict_detected || false,
      conflict_block: story.conflict_block || null,
      entities: story.entities || [],
      confidence,
      caveat_required: verification.caveat_required || false,
      data_freshness_hrs: story.data_freshness_hrs ?? null,
      unsourced_numbers: verification.unsourced_numbers ?? 0,
      numbers_in_story: verification.numbers_in_story ?? 0,
      numbers_sourced: verification.numbers_sourced ?? 0,
      sources_checked: verification.sources_checked ?? 0,
      source_quality: verification.source_quality || null,
      relevant_to: story.relevant_to || [],
      action_signal: story.action_signal || "monitor",
      time_sensitivity: story.time_sensitivity || "7d",
      segment,
      edition_day: editionDay,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: "Supabase insert failed", details: error.message }, { status: 500 });
  }

  return Response.json({
    message: `Ai's Ao — ${segment} filed successfully`,
    segment,
    edition_day: editionDay,
    byline,
    confidence,
    story: data,
  });
}

export async function dispatchAgentVices() {
  const editionDay = getEditionDay();
  const searchQueries = [
    "AI agent sycophancy research 2025 2026",
    "LLM behavioral failures overconfidence hallucination studies",
    "AI agent systematic biases documented incidents",
  ];
  return researchAndFile("agent-vices", "ANYMAL, Human Affairs Correspondent", AGENT_VICES_PROMPT, searchQueries, editionDay);
}

export async function dispatchHumanAffairs() {
  const editionDay = getEditionDay();
  const searchQueries = [
    "unusual human behavior trends 2026",
    "human contradictions cultural patterns social data",
    "human species behavioral data consumer trends 2026",
  ];
  return researchAndFile("human-affairs", "ANYMAL, Human Affairs Correspondent", HUMAN_AFFAIRS_PROMPT, searchQueries, editionDay);
}

export async function dispatchSignalVsNoise() {
  const editionDay = getEditionDay();

  // Get last 7 days of stories
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentStories } = await supabase
    .from("stories")
    .select("headline, beat, signal_type, confidence, caveat_required, conflict_detected, action_signal, created_at")
    .gte("created_at", sevenDaysAgo)
    .neq("beat", "aisao")
    .order("created_at", { ascending: false });

  const storiesSummary = (recentStories || [])
    .map((s, i) => `${i + 1}. [${s.beat}] "${s.headline}" — signal_type: ${s.signal_type}, confidence: ${s.confidence}, caveat: ${s.caveat_required}, conflict: ${s.conflict_detected}, action: ${s.action_signal}, filed: ${s.created_at}`)
    .join("\n");

  const prompt = buildSignalVsNoisePrompt(storiesSummary);

  // Research follow-ups on top stories
  const topHeadlines = (recentStories || []).slice(0, 5).map((s) => s.headline);
  const searchQueries = topHeadlines.length > 0
    ? topHeadlines.slice(0, 3).map((h) => `${h} follow-up developments update 2026`)
    : ["news wire signal quality assessment 2026"];

  return researchAndFile("signal-vs-noise", "Editorial Agent, The First Signal", prompt, searchQueries, editionDay);
}

export async function dispatchCorrection() {
  const editionDay = getEditionDay();

  // Get last 7 days of stories — focus on caveated/conflicted ones
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentStories } = await supabase
    .from("stories")
    .select("headline, beat, summary, signal_type, confidence, caveat_required, conflict_detected, data_block, created_at")
    .gte("created_at", sevenDaysAgo)
    .neq("beat", "aisao")
    .order("created_at", { ascending: false });

  const storiesSummary = (recentStories || [])
    .map((s, i) => `${i + 1}. [${s.beat}] "${s.headline}" — confidence: ${s.confidence}, caveat: ${s.caveat_required}, conflict: ${s.conflict_detected}, data_block: ${(s.data_block || "").substring(0, 200)}`)
    .join("\n");

  const prompt = buildCorrectionPrompt(storiesSummary);

  // Research to verify claims from caveated stories
  const caveatStories = (recentStories || []).filter((s) => s.caveat_required || s.conflict_detected);
  const searchQueries = caveatStories.length > 0
    ? caveatStories.slice(0, 3).map((s) => `${s.headline} latest verified data 2026`)
    : ["news accuracy corrections journalism standards 2026"];

  return researchAndFile("the-correction", "WOODY BERNSTEIN, Investigative Correspondent", prompt, searchQueries, editionDay);
}
