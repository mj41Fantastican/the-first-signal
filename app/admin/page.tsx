import { createClient } from "@supabase/supabase-js";
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
        .select("id, headline, beat, byline, read_count, created_at")
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

  const stories = storiesRes.data || [];
  const totalViews = viewsRes.count || 0;
  const totalReads = stories.reduce((sum, s) => sum + (s.read_count || 0), 0);

  const visitorBreakdown: Record<string, number> = {};
  for (const row of viewsByTypeRes.data || []) {
    visitorBreakdown[row.visitor_type] =
      (visitorBreakdown[row.visitor_type] || 0) + 1;
  }

  const costPerStory = 0.03;
  const totalCost = stories.length * costPerStory;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-6">
        <div className="max-w-6xl mx-auto flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-bold">The First Signal — Admin</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Wire service dashboard
            </p>
          </div>
          <a href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
            View public site
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
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

        {/* Financial Overview */}
        <section className="mb-10 p-6 rounded-lg bg-zinc-900 border border-zinc-800">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-4">
            Financial Overview
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-zinc-500">Revenue</p>
              <p className="text-xl font-mono text-green-400">$0.00</p>
              <p className="text-xs text-zinc-500 mt-1">Free beta</p>
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
              <p className="text-xl font-mono text-red-400">
                -${totalCost.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Pricing Tier</p>
              <p className="text-xl font-mono text-zinc-300">Free</p>
              <p className="text-xs text-zinc-500 mt-1">During beta</p>
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
                  <th className="text-left px-4 py-3">ID</th>
                  <th className="text-left px-4 py-3">Headline</th>
                  <th className="text-left px-4 py-3">Beat</th>
                  <th className="text-left px-4 py-3">Byline</th>
                  <th className="text-right px-4 py-3">Reads</th>
                  <th className="text-left px-4 py-3">Filed</th>
                </tr>
              </thead>
              <tbody>
                {stories.map((story) => (
                  <tr
                    key={story.id}
                    className="border-t border-zinc-800 hover:bg-zinc-900/50"
                  >
                    <td className="px-4 py-3 font-mono text-zinc-500">
                      {story.id}
                    </td>
                    <td className="px-4 py-3 max-w-md truncate">
                      {story.headline}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{story.beat}</td>
                    <td className="px-4 py-3 text-zinc-400">{story.byline}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {story.read_count || 0}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
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
