import { generateSalesPitch, generateTeaser } from "@/lib/sales-agent";

export const dynamic = "force-dynamic";

// GET — Generate a fresh teaser (lightweight, for quick promo)
export async function GET() {
  try {
    const teaser = await generateTeaser();
    return Response.json({
      agent: "SULLY, Sales & Discovery Agent",
      type: "teaser",
      ...teaser,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

// POST — Generate full registry listings and agent pitches
export async function POST() {
  try {
    const pitch = await generateSalesPitch();
    return Response.json({
      agent: "SULLY, Sales & Discovery Agent",
      type: "full_pitch",
      generated_at: new Date().toISOString(),
      note: "Use these listings to submit The First Signal to MCP registries, API directories, and agent tool catalogs. Each section is optimized for its target platform.",
      ...pitch,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
