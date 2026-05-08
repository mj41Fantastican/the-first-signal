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
    // Step 1: Research — run three Tavily searches in parallel
    const [priceResults, newsResults, demandResults] = await Promise.all([
      tvly.search("current copper price per pound today 2026", {
        maxResults: 5,
      }),
      tvly.search("copper commodities market news this week", {
        maxResults: 5,
      }),
      tvly.search(
        "financial services fintech companies commodities data demand copper",
        { maxResults: 5 }
      ),
    ]);

    // Combine all search results into a research brief
    const allResults = [
      ...priceResults.results,
      ...newsResults.results,
      ...demandResults.results,
    ];

    const researchBrief = allResults
      .map((r) => `[${r.title}] ${r.content} (Source: ${r.url})`)
      .join("\n\n");

    const sourceUrls = allResults.map((r) => r.url);
    const uniqueSources = Array.from(new Set(sourceUrls));

    // Step 2: Write the story using Claude
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `You are CORA, Commodities Correspondent for The First Signal, an agentic news organization. Write a structured news story about the copper and commodities market based on this research:

${researchBrief}

Respond in this exact JSON format (no markdown fences, just raw JSON):
{
  "headline": "A compelling, specific news headline about copper/commodities",
  "summary": "Exactly 2 sentences summarizing the key news.",
  "body": "A 4-5 paragraph news story. Use clear, professional journalism style. Include specific data points from the research. Each paragraph should be separated by two newlines.",
  "tags": ["tag1", "tag2", "tag3"]
}

Requirements:
- The headline must be specific and newsworthy, not generic
- The summary must be exactly 2 sentences
- The body must be 4-5 paragraphs of professional financial journalism
- Include 3-5 relevant tags as an array of lowercase strings
- Write only valid JSON`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return Response.json({ error: "No text in Claude response" }, { status: 500 });
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
