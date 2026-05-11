import { createClient } from "@supabase/supabase-js";
import { getRevenueStats } from "@/lib/meter";
import AgentControls from "./cora-controls";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export default async function AdminDashboard() {
  const [storiesRes, viewsRes, viewsByTypeRes, recentViewsRes, coraConfigRes] =
    await Promise.all([
      supabase
        .from("stories")
        .select("id, headline, beat, byline, read_count, status, signal_type, confidence, caveat_required, conflict_detected, action_signal, time_sensitivity, unsourced_numbers, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("page_views")
        .select("id", { count: "exact", head: true }),
      supabase.from("page_views").select("visitor_type"),
      supabase
        .from("page_views")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("agent_config")
        .select("*")
        .order("id"),
    ]);

  const revenue = await getRevenueStats();

  const stories = storiesRes.data || [];
  const totalViews = viewsRes.count || 0;
  const totalReads = stories.reduce((sum, s) => sum + (s.read_count || 0), 0);

  const visitorBreakdown: Record<string, number> = {};
  for (const row of viewsByTypeRes.data || []) {
    visitorBreakdown[row.visitor_type] =
      (visitorBreakdown[row.visitor_type] || 0) + 1;
  }

  // Directive stats
  const publishedCount = stories.filter((s) => s.status === "published").length;
  const needsReviewCount = stories.filter((s) => s.status === "needs_review").length;
  const filedCount = stories.filter((s) => s.status === "filed").length;
  const conflictCount = stories.filter((s) => s.conflict_detected).length;
  const caveatCount = stories.filter((s) => s.caveat_required).length;
  const avgConfidence = stories.filter((s) => s.confidence != null).length > 0
    ? stories.filter((s) => s.confidence != null).reduce((sum, s) => sum + (s.confidence || 0), 0) / stories.filter((s) => s.confidence != null).length
    : 0;

  // Signal type breakdown
  const signalBreakdown: Record<string, number> = {};
  for (const s of stories) {
    if (s.signal_type) {
      signalBreakdown[s.signal_type] = (signalBreakdown[s.signal_type] || 0) + 1;
    }
  }

  const costPerStory = 0.03;
  const totalCost = stories.length * costPerStory;
  const netRevenue = revenue.revenue - totalCost;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-6">
        <div className="max-w-7xl mx-auto flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-bold">The First Signal — Admin</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Wire service dashboard — Directive v1.0
            </p>
          </div>
          <a href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
            View public site
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard label="Stories Filed" value={String(stories.length)} />
          <StatCard label="Total Page Views" value={String(totalViews)} />
          <StatCard label="Story Reads" value={String(totalReads)} />
          <StatCard
            label="Agent Visitors"
            value={String(visitorBreakdown["agent"] || 0)}
          />
        </div>

        {/* Wire Integrity */}
        <section className="mb-10 p-6 rounded-lg bg-zinc-900 border border-zinc-800">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-4">
            Wire Integrity — Directive v1.0
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
            <div>
              <p className="text-xs text-zinc-500">Published</p>
              <p className="text-2xl font-mono text-green-400">{publishedCount}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Needs Review</p>
              <p className={`text-2xl font-mono ${needsReviewCount > 0 ? "text-yellow-400" : "text-zinc-400"}`}>{needsReviewCount}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Legacy (filed)</p>
              <p className="text-2xl font-mono text-zinc-500">{filedCount}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Avg Confidence</p>
              <p className={`text-2xl font-mono ${avgConfidence >= 0.80 ? "text-green-400" : avgConfidence >= 0.70 ? "text-yellow-400" : "text-red-400"}`}>
                {avgConfidence > 0 ? avgConfidence.toFixed(2) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Conflicts</p>
              <p className={`text-2xl font-mono ${conflictCount > 0 ? "text-orange-400" : "text-zinc-400"}`}>{conflictCount}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Caveats</p>
              <p className={`text-2xl font-mono ${caveatCount > 0 ? "text-yellow-400" : "text-zinc-400"}`}>{caveatCount}</p>
            </div>
          </div>

          {/* Signal Type Breakdown */}
          {Object.keys(signalBreakdown).length > 0 && (
            <div className="mt-4 pt-4 border-t border-zinc-800">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Signal Types</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(signalBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <span key={type} className="text-xs font-mono px-2 py-1 rounded bg-zinc-800 text-zinc-300">
                      {type}: {count}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </section>

        {/* Financial Overview */}
        <section className="mb-10 p-6 rounded-lg bg-zinc-900 border border-zinc-800">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-4">
            Financial Overview
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-zinc-500">Metered Revenue</p>
              <p className={`text-xl font-mono ${revenue.revenue > 0 ? "text-green-400" : "text-zinc-400"}`}>
                ${revenue.revenue.toFixed(2)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {revenue.billableCalls} paid calls @ ${revenue.pricePerCall}/ea
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">API Costs (est.)</p>
              <p className="text-xl font-mono text-red-400">
                ${totalCost.toFixed(2)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                ~$0.03/story (Tavily + Claude)
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Net</p>
              <p className={`text-xl font-mono ${netRevenue >= 0 ? "text-green-400" : "text-red-400"}`}>
                {netRevenue >= 0 ? "" : "-"}${Math.abs(netRevenue).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Revenue Cap</p>
              <p className={`text-xl font-mono ${revenue.capped ? "text-red-400" : "text-zinc-300"}`}>
                ${revenue.revenue.toFixed(2)} / ${revenue.revenueCap.toFixed(2)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {revenue.capped ? "CAPPED — API paused" : "Active"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-4 pt-4 border-t border-zinc-800">
            <div>
              <p className="text-xs text-zinc-500">Total API Calls</p>
              <p className="text-lg font-mono">{revenue.totalCalls}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Free Calls</p>
              <p className="text-lg font-mono">{revenue.freeCalls}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Billable Calls</p>
              <p className="text-lg font-mono">{revenue.billableCalls}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Pricing</p>
              <p className="text-lg font-mono">
                1 free, then ${revenue.pricePerCall}/call
              </p>
            </div>
          </div>
        </section>

        {/* Agent Controls */}
        {coraConfigRes.data && coraConfigRes.data.length > 0 && (
          <AgentControls agents={coraConfigRes.data} />
        )}

        {/* Visitor Breakdown */}
        <section className="mb-10 p-6 rounded-lg bg-zinc-900 border border-zinc-800">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-4">
            Visitor Breakdown
          </h2>
          <div className="grid grid-cols-3 gap-6">
            {Object.entries(visitorBreakdown).map(([type, count]) => (
              <div key={type}>
                <p className="text-xs text-zinc-500 capitalize">{type}</p>
                <p className="text-2xl font-mono">{count}</p>
              </div>
            ))}
            {Object.keys(visitorBreakdown).length === 0 && (
              <p className="text-zinc-500 text-sm">No visitors yet</p>
            )}
          </div>
        </section>

        {/* Stories Table */}
        <section className="mb-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-4">
            Stories
          </h2>
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-3">ID</th>
                  <th className="text-left px-3 py-3">Status</th>
                  <th className="text-left px-3 py-3">Signal</th>
                  <th className="text-left px-3 py-3">Headline</th>
                  <th className="text-left px-3 py-3">Beat</th>
                  <th className="text-center px-3 py-3">Conf</th>
                  <th className="text-center px-3 py-3">Flags</th>
                  <th className="text-left px-3 py-3">Action</th>
                  <th className="text-right px-3 py-3">Reads</th>
                  <th className="text-left px-3 py-3">Filed</th>
                </tr>
              </thead>
              <tbody>
                {stories.map((story) => (
                  <tr
                    key={story.id}
                    className={`border-t border-zinc-800 hover:bg-zinc-900/50 ${
                      story.status === "needs_review" ? "bg-yellow-950/20" : ""
                    }`}
                  >
                    <td className="px-3 py-3 font-mono text-zinc-500">
                      {story.id}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                        story.status === "published"
                          ? "bg-green-900/50 text-green-300"
                          : story.status === "needs_review"
                          ? "bg-yellow-900/50 text-yellow-300"
                          : "bg-zinc-800 text-zinc-400"
                      }`}>
                        {story.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {story.signal_type ? (
                        <span className="text-xs font-mono text-zinc-300">
                          {story.signal_type}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 max-w-xs truncate">
                      {story.headline}
                    </td>
                    <td className="px-3 py-3 text-zinc-400">{story.beat}</td>
                    <td className="px-3 py-3 text-center">
                      {story.confidence != null ? (
                        <span className={`text-xs font-mono ${
                          story.confidence >= 0.85
                            ? "text-green-400"
                            : story.confidence >= 0.70
                            ? "text-yellow-400"
                            : "text-red-400"
                        }`}>
                          {Number(story.confidence).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        {story.conflict_detected && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-orange-900/50 text-orange-300" title="Conflict detected">
                            C
                          </span>
                        )}
                        {story.caveat_required && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-900/50 text-yellow-300" title="Caveat required">
                            !
                          </span>
                        )}
                        {(story.unsourced_numbers || 0) > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/50 text-red-300" title="Unsourced numbers">
                            U
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {story.action_signal ? (
                        <span className={`text-xs font-mono ${
                          story.action_signal === "act"
                            ? "text-green-400"
                            : story.action_signal === "alert"
                            ? "text-red-400"
                            : "text-zinc-400"
                        }`}>
                          {story.action_signal}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-mono">
                      {story.read_count || 0}
                    </td>
                    <td className="px-3 py-3 text-zinc-400 text-xs">
                      {new Date(story.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent Activity */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-4">
            Recent Activity
          </h2>
          <div className="space-y-2">
            {(recentViewsRes.data || []).map((view) => (
              <div
                key={view.id}
                className="flex items-center justify-between text-sm px-4 py-2 rounded bg-zinc-900 border border-zinc-800"
              >
                <span className="font-mono text-zinc-300">{view.page}</span>
                <div className="flex items-center gap-4">
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      view.visitor_type === "agent"
                        ? "bg-blue-900/50 text-blue-300"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {view.visitor_type}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {new Date(view.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
            {(recentViewsRes.data || []).length === 0 && (
              <p className="text-zinc-500 text-sm">No activity yet</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
      <p className="text-xs text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-mono mt-1">{value}</p>
    </div>
  );
}
