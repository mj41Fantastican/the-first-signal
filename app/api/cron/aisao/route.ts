import {
  dispatchAgentVices,
  dispatchHumanAffairs,
  dispatchSignalVsNoise,
  dispatchCorrection,
} from "@/lib/aisao";
import { dispatchWoody } from "@/lib/woody";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 6 AM CT = 11 AM UTC
// Mon → agent-vices, Tue → human-affairs, Wed → signal-vs-noise,
// Thu → agent-vices, Fri → human-affairs, Sat → the-correction,
// Sun → woody expose

const SCHEDULE: Record<number, { name: string; dispatch: () => Promise<Response> }> = {
  1: { name: "agent-vices", dispatch: dispatchAgentVices },
  2: { name: "human-affairs", dispatch: dispatchHumanAffairs },
  3: { name: "signal-vs-noise", dispatch: dispatchSignalVsNoise },
  4: { name: "agent-vices", dispatch: dispatchAgentVices },
  5: { name: "human-affairs", dispatch: dispatchHumanAffairs },
  6: { name: "the-correction", dispatch: dispatchCorrection },
  0: { name: "woodys-expose", dispatch: dispatchWoody },
};

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dayOfWeek = new Date().getUTCDay();
  const scheduled = SCHEDULE[dayOfWeek];

  if (!scheduled) {
    return Response.json({ error: "No segment scheduled for today" }, { status: 404 });
  }

  try {
    const response = await scheduled.dispatch();
    const data = await response.json();

    return Response.json({
      message: `Ai's Ao cron: ${scheduled.name} dispatched`,
      day: dayOfWeek,
      segment: scheduled.name,
      result: data,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({
      error: `Ai's Ao cron failed: ${message}`,
      segment: scheduled.name,
    }, { status: 500 });
  }
}
