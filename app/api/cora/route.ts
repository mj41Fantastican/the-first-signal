import Anthropic from "@anthropic-ai/sdk";
import { tavily } from "@tavily/core";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY! });
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function POST() {
  try {
    // Load CORA's config from Supabase
    const { data: config } = await supabase
      .from("agent_config")
      .select("*")
      .eq("id", "cora")
      .single();

    if (!config?.active) {
      return Response.json(
        { error: "CORA is currently deactivated" },
        { status: 403 }
      );
    }

    const tone = config?.tone || "professional financial journalism";
    const focus = config?.focus || "copper prices, supply chain, market trends";
    const extraInstructions = config?.instructions || "";

    // Pull last 3 headlines to avoid repeating angles
    const { data: recentStories } = await supabase
      .from("stories")
      .select("headline, summary")
      .eq("beat", "commodities")
      .order("created_at", { ascending: false })
      .limit(3);

    const recentHeadlines = (recentStories || [])
      .map((s, i) => `${i + 1}. "${s.headline}" — ${s.summary}`)
      .join("\n");

    // Step 1: Research — run three Tavily searches in parallel
    const focusTerms = focus.split(",").map((t: string) => t.trim());
    const searchQueries = [
      `current copper price per pound today 2026`,
      `copper commodities market news this week ${focusTerms[0] || ""}`,
      `${focusTerms.slice(1).join(" ") || "financial services fintech companies commodities data demand copper"}`,
    ];

    const [result1, result2, result3] = await Promise.all(
      searchQueries.map((q) => tvly.search(q, { maxResults: 5 }))
    );

    // Combine all search results into a research brief
    const allResults = [
      ...result1.results,
      ...result2.results,
      ...result3.results,
    ];

    const researchBrief = allResults
      .map((r) => `[${r.title}] ${r.content} (Source: ${r.url})`)
      .join("\n\n");

    const sourceUrls = allResults.map((r) => r.url);
    const uniqueSources = Array.from(new Set(sourceUrls));

    // Step 2: Write the story using Claude
    const avoidSection = recentHeadlines
      ? `\n\nRECENT STORIES ALREADY FILED (DO NOT repeat these angles, find a fresh angle):\n${recentHeadlines}\n`
      : "";

    const customSection = extraInstructions
      ? `\n\nADDITIONAL EDITOR INSTRUCTIONS:\n${extraInstructions}\n`
      : "";

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `You are CORA, Commodities Correspondent for The First Signal, an agentic news organization. Write a structured news story about the copper and commodities market based on this research:

${researchBrief}
${avoidSection}${customSection}
Respond in this exact JSON format (no markdown fences, just raw JSON):
{
  "headline": "A compelling, specific news headline about copper/commodities",
  "summary": "Exactly 2 sentences summarizing the key news.",
  "body": "A 4-5 paragraph news story. Each paragraph should be separated by two newlines.",
  "tags": ["tag1", "tag2", "tag3"]
}

Requirements:
- The headline must be specific and newsworthy, not generic
- Find a FRESH angle that differs from any recent stories listed above
- The summary must be exactly 2 sentences
- The body must be 4-5 paragraphs of ${tone}
- Focus areas: ${focus}
- Include specific data points from the research
- Include 3-5 relevant tags as an array of lowercase strings
- Write only valid JSON`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return Response.json(
        { error: "No text in Claude response" },
        { status: 500 }
      );
    }

    const story = JSON.parse(textBlock.text);

    // Step 3: Save to Supabase
    const { data, error } = await supabase
      .from("stories")
      .insert({
        headline: story.headline,
        summary: story.summary,
        body: story.body,
        sources: uniqueSources,
        beat: "commodities",
        status: "filed",
        byline: "CORA, Commodities Correspondent",
        tags: story.tags,
      })
      .select()
      .single();

    if (error) {
      return Response.json(
        { error: "Supabase insert failed", details: error.message },
        { status: 500 }
      );
    }

    return Response.json({
      message: "Story filed successfully",
      story: data,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
