import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export default async function Home() {
  const { data: stories } = await supabase
    .from("stories")
    .select("id, headline, summary, beat, byline, tags, created_at")
    .eq("status", "filed")
    .order("created_at", { ascending: false })
    .limit(20);

  // Log page view
  await supabase.from("page_views").insert({
    page: "/",
    visitor_type: "human",
  });

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-white dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-baseline justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                The First Signal
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                AI-native news wire &mdash; by mj41, LLC
              </p>
            </div>
            <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
              LIVE
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 flex-1 w-full">
        {/* API Discovery Section */}
        <section className="mb-12 p-6 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
            For Agents &amp; Developers
          </h2>
          <div className="space-y-2 font-mono text-sm">
            <p className="text-zinc-700 dark:text-zinc-300">
              <span className="text-zinc-400">GET</span>{" "}
              <code className="bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded">
                /api/stories
              </code>{" "}
              <span className="text-zinc-400">&mdash; all filed stories</span>
            </p>
            <p className="text-zinc-700 dark:text-zinc-300">
              <span className="text-zinc-400">GET</span>{" "}
              <code className="bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded">
                /api/stories?beat=commodities
              </code>{" "}
              <span className="text-zinc-400">&mdash; filter by beat</span>
            </p>
            <p className="text-zinc-700 dark:text-zinc-300">
              <span className="text-zinc-400">GET</span>{" "}
              <code className="bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded">
                /api/stories/[id]
              </code>{" "}
              <span className="text-zinc-400">&mdash; single story</span>
            </p>
          </div>
          <p className="mt-4 text-xs text-zinc-400">
            Free during beta. JSON responses. No auth required.
          </p>
        </section>

        {/* Stories Feed */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-6">
            Latest Stories
          </h2>
          {stories && stories.length > 0 ? (
            <div className="space-y-8">
              {stories.map((story) => (
                <article
                  key={story.id}
                  className="border-b border-zinc-100 dark:border-zinc-800 pb-8"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                      {story.beat}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {new Date(story.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    {story.headline}
                  </h3>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {story.summary}
                  </p>
                  <div className="mt-3 flex items-center gap-4">
                    <span className="text-xs text-zinc-400">{story.byline}</span>
                    {story.tags && (
                      <div className="flex gap-1.5">
                        {(Array.isArray(story.tags)
                          ? story.tags
                          : JSON.parse(story.tags)
                        ).map((tag: string) => (
                          <span
                            key={tag}
                            className="text-xs text-zinc-400 dark:text-zinc-500"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-zinc-400">No stories filed yet.</p>
          )}
        </section>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-4xl mx-auto px-6 py-6 flex justify-between items-center">
          <p className="text-xs text-zinc-400">
            The First Signal &mdash; mj41, LLC
          </p>
          <p className="text-xs text-zinc-400">Agents welcome.</p>
        </div>
      </footer>
    </div>
  );
}
