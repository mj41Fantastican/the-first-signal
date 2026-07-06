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

export async function dispatchReporter(agentId: string) {
  const { data: config } = await supabase
    .from("agent_config")
    .select("*")
    .eq("id", agentId)
    .single();

  if (!config) {
    return Response.json({ error: `Agent "${agentId}" not found` }, { status: 404 });
  }

  if (!config.active) {
    return Response.json(
      { error: `${config.display_name} is currently deactivated` },
      { status: 403 }
    );
  }

  const beat = config.beat || agentId;
  const byline = config.display_name || agentId;

  // Structural config fields — these drive search and output, not prose
  const searchQueries: string[] = config.search_queries && config.search_queries.length > 0
    ? config.search_queries
    : buildDefaultSearchQueries(beat, config.focus || "");
  const requiredDataFields: string[] = config.required_data_block_fields || [];
  const primaryEntityTags: string[] = config.primary_entity_tags || [];
  const defaultSignalTypes: string[] = config.default_signal_types || [];

  // Pull last 3 headlines for this beat to avoid repeating angles
  const { data: recentStories } = await supabase
    .from("stories")
    .select("headline, summary")
    .eq("beat", beat)
    .order("created_at", { ascending: false })
    .limit(3);

  const recentHeadlines = (recentStories || [])
    .map((s: { headline: string; summary: string }, i: number) => `${i + 1}. "${s.headline}" — ${s.summary}`)
    .join("\n");

  // Research
  const [result1, result2, result3] = await Promise.all(
    searchQueries.slice(0, 3).map((q) => tvly.search(q, { maxResults: 5 }))
  );

  const allResults = [
    ...result1.results,
    ...result2.results,
    ...result3.results,
  ];

  const numberedSources = buildNumberedSources(allResults);
  const sourceUrls = allResults.map((r) => r.url);
  const uniqueSources = Array.from(new Set(sourceUrls));

  const avoidSection = recentHeadlines
    ? `\nDO NOT repeat these angles:\n${recentHeadlines}\n`
    : "";

  // Build structural context — no prose instructions
  const structuralContext = [
    `BEAT: ${beat}`,
    `BYLINE: ${byline}`,
    requiredDataFields.length > 0
      ? `REQUIRED_DATA_BLOCK_FIELDS: ${requiredDataFields.join(", ")}`
      : null,
    primaryEntityTags.length > 0
      ? `PRIMARY_ENTITY_TAGS: ${primaryEntityTags.join(", ")}`
      : null,
    defaultSignalTypes.length > 0
      ? `EXPECTED_SIGNAL_TYPES: ${defaultSignalTypes.join(", ")}`
      : null,
  ].filter(Boolean).join("\n");

  const outputInstruction = buildOutputInstruction(beat, byline);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    messages: [
      {
        role: "user",
        content: `${UNIVERSAL_DIRECTIVE}

${structuralContext}
${avoidSection}
NUMBERED RESEARCH SOURCES:
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

  const { data, error } = await supabase
    .from("stories")
    .insert({
      headline: story.headline,
      summary: story.summary,
      body: story.body,
      sources: uniqueSources,
      beat,
      status,
      byline,
      tags: story.tags || [],
      signal_type: story.signal_type || null,
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
    return Response.json({ error: "Supabase insert failed", details: error.message }, { status: 500 });
  }

  return Response.json({
    message: "Story filed successfully",
    status,
    signal_type: story.signal_type,
    confidence,
    caveat_required: verification.caveat_required,
    story: data,
  });
}

function buildDefaultSearchQueries(beat: string, focus: string): string[] {
  const focusTerms = focus.split(",").map((t: string) => t.trim()).filter(Boolean);
  return [
    `${focusTerms[0] || beat} latest news today 2026`,
    `${focusTerms[1] || beat} market trends this week`,
    `${focusTerms.slice(2).join(" ") || beat} industry analysis developments`,
  ];
}
