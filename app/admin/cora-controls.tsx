"use client";

import { useState } from "react";

interface AgentConfig {
  id: string;
  display_name: string;
  beat: string;
  tone: string;
  focus: string;
  instructions: string;
  active: boolean;
  updated_at: string;
}

const BEAT_REPORTERS = [
  "algo", "anymal", "bambi", "becky", "blaise", "cora",
  "dalton", "finn", "mahesh", "rex", "richard", "riplo", "roofus", "sammy",
];

export default function AgentControls({ agents }: { agents: AgentConfig[] }) {
  return (
    <div className="space-y-6">
      <DispatchAllPanel agents={agents} />
      <WoodyQueuePanel />
      {agents.map((agent) => (
        <AgentPanel key={agent.id} initial={agent} />
      ))}
    </div>
  );
}

function DispatchAllPanel({ agents }: { agents: AgentConfig[] }) {
  const [dispatching, setDispatching] = useState(false);
  const [results, setResults] = useState<{ agent: string; status: string; headline?: string }[]>([]);
  const [progress, setProgress] = useState(0);

  async function dispatchAll() {
    setDispatching(true);
    setResults([]);
    setProgress(0);

    const activeReporters = BEAT_REPORTERS.filter((id) =>
      agents.find((a) => a.id === id && a.active)
    );

    const newResults: { agent: string; status: string; headline?: string }[] = [];

    for (const agentId of activeReporters) {
      try {
        const res = await fetch(`/api/${agentId}`, { method: "POST" });
        const data = await res.json();
        if (res.ok && data.story) {
          newResults.push({ agent: agentId, status: data.status || "published", headline: data.story.headline });
        } else {
          newResults.push({ agent: agentId, status: `error: ${data.error || "unknown"}` });
        }
      } catch (err) {
        newResults.push({ agent: agentId, status: "error: network failure" });
      }
      setResults([...newResults]);
      setProgress(newResults.length);
    }

    setDispatching(false);
  }

  const activeCount = BEAT_REPORTERS.filter((id) =>
    agents.find((a) => a.id === id && a.active)
  ).length;

  return (
    <section className="mb-4 p-6 rounded-lg bg-zinc-900 border border-blue-800">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-blue-400">
            Dispatch All Reporters
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Send all {activeCount} active beat reporters on assignment
          </p>
        </div>
        <button
          onClick={dispatchAll}
          disabled={dispatching}
          className="px-5 py-2.5 text-sm font-bold rounded bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-50"
        >
          {dispatching
            ? `Dispatching... (${progress}/${activeCount})`
            : "Dispatch All"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="mt-4 space-y-1">
          {results.map((r) => (
            <div key={r.agent} className={`flex items-center gap-3 text-xs font-mono px-3 py-1.5 rounded ${
              r.status.startsWith("error") ? "bg-red-950/30 text-red-300" : "bg-green-950/30 text-green-300"
            }`}>
              <span className="uppercase w-16">{r.agent}</span>
              <span className={`px-1.5 py-0.5 rounded ${
                r.status.startsWith("error") ? "bg-red-900/50" : "bg-green-900/50"
              }`}>
                {r.status.startsWith("error") ? "FAIL" : r.status}
              </span>
              <span className="truncate text-zinc-300">{r.headline || r.status}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function WoodyQueuePanel() {
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState<{ pending: number; topics: string[] } | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [submitResult, setSubmitResult] = useState("");

  async function loadQueue() {
    setLoading(true);
    try {
      const res = await fetch("/api/requests");
      const data = await res.json();
      const pending = (data.requests || []).filter((r: { status: string }) => r.status === "pending");
      setQueue({ pending: pending.length, topics: pending.slice(0, 5).map((r: { topic: string; fast_tracked: boolean }) => `${r.fast_tracked ? "[PAID] " : ""}${r.topic}`) });
    } catch {
      setQueue({ pending: 0, topics: [] });
    }
    setLoading(false);
  }

  async function dispatchWoody() {
    setDispatching(true);
    setDispatchResult("");
    try {
      const res = await fetch("/api/woody", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setDispatchResult(`Filed: "${data.story?.headline || data.request_topic}" (${data.seven_one_rule})`);
        loadQueue();
      } else {
        setDispatchResult(`Error: ${data.error}`);
      }
    } catch {
      setDispatchResult("Error: network failure");
    }
    setDispatching(false);
  }

  async function submitRequest(andDispatch = false) {
    if (!topic.trim()) return;
    setSubmitting(true);
    setSubmitResult("");
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), description: description.trim() || topic.trim(), submitted_by: "admin" }),
      });
      const data = await res.json();
      if (res.ok) {
        if (andDispatch) {
          setSubmitResult(`Submitted: "${topic.trim()}" — dispatching Woody...`);
          setTopic("");
          setDescription("");
          // Dispatch Woody immediately after submitting
          setDispatching(true);
          try {
            const woodyRes = await fetch("/api/woody", { method: "POST" });
            const woodyData = await woodyRes.json();
            if (woodyRes.ok) {
              setDispatchResult(`Filed: "${woodyData.story?.headline || woodyData.request_topic}" (${woodyData.seven_one_rule})`);
              setSubmitResult(`Submitted & dispatched: "${data.request?.topic || topic.trim()}"`);
            } else {
              setDispatchResult(`Error: ${woodyData.error}`);
            }
          } catch {
            setDispatchResult("Error: network failure");
          }
          setDispatching(false);
        } else {
          setSubmitResult(`Submitted: "${topic.trim()}"`);
          setTopic("");
          setDescription("");
        }
        loadQueue();
      } else {
        setSubmitResult(`Error: ${data.error}`);
      }
    } catch {
      setSubmitResult("Error: network failure");
    }
    setSubmitting(false);
  }

  return (
    <section className="mb-4 p-6 rounded-lg bg-zinc-900 border border-amber-800">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-400">
            Woody Bernstein — Investigative Queue
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Submission queue + dispatch for Sunday exposes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadQueue}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Check Queue"}
          </button>
          <button
            onClick={dispatchWoody}
            disabled={dispatching || (queue !== null && queue.pending === 0)}
            className="px-4 py-1.5 text-xs font-bold rounded bg-amber-700 hover:bg-amber-600 text-white disabled:opacity-50"
          >
            {dispatching ? "Woody is writing..." : "Dispatch Woody"}
          </button>
        </div>
      </div>

      {queue !== null && (
        <div className="mb-4">
          <p className="text-sm font-mono text-zinc-300">
            {queue.pending === 0
              ? "Queue is empty — submit a topic below"
              : `${queue.pending} pending request${queue.pending > 1 ? "s" : ""}`}
          </p>
          {queue.topics.length > 0 && (
            <div className="mt-2 space-y-1">
              {queue.topics.map((t, i) => (
                <p key={i} className="text-xs font-mono text-zinc-400 px-3 py-1 bg-zinc-800 rounded">
                  {t}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {dispatchResult && (
        <p className="mb-4 text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded">
          {dispatchResult}
        </p>
      )}

      {/* Submit a topic */}
      <div className="pt-4 border-t border-zinc-800">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Submit a Topic for Woody</p>
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic (e.g. AI agents manipulating search results)"
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description / angle (optional)"
            rows={2}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => submitRequest(false)}
              disabled={submitting || dispatching || !topic.trim()}
              className="px-4 py-2 text-sm font-medium rounded bg-amber-800 hover:bg-amber-700 text-amber-100 disabled:opacity-50"
            >
              {submitting && !dispatching ? "Submitting..." : "Submit to Queue"}
            </button>
            <button
              onClick={() => submitRequest(true)}
              disabled={submitting || dispatching || !topic.trim()}
              className="px-4 py-2 text-sm font-bold rounded bg-green-700 hover:bg-green-600 text-white disabled:opacity-50"
            >
              {dispatching ? "Woody is writing..." : "Submit & Run Now"}
            </button>
            {submitResult && (
              <span className="text-xs text-zinc-400">{submitResult}</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function AgentPanel({ initial }: { initial: AgentConfig }) {
  const [config, setConfig] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState("");

  async function save() {
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (res.ok) {
      const updated = await res.json();
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  async function dispatch() {
    setDispatching(true);
    setDispatchResult("");
    const res = await fetch(`/api/${config.id}`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setDispatchResult(`Filed: "${data.story.headline}"`);
    } else {
      setDispatchResult(`Error: ${data.error}`);
    }
    setDispatching(false);
  }

  return (
    <section className="mb-4 p-6 rounded-lg bg-zinc-900 border border-zinc-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            {config.display_name}
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Beat: {config.beat} &middot; Route: POST /api/{config.id}
          </p>
        </div>
        <button
          onClick={() => setConfig({ ...config, active: !config.active })}
          className={`text-xs font-mono px-3 py-1 rounded ${
            config.active
              ? "bg-green-900/50 text-green-300 border border-green-700"
              : "bg-red-900/50 text-red-300 border border-red-700"
          }`}
        >
          {config.active ? "ACTIVE" : "DEACTIVATED"}
        </button>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1">
            Tone / Writing Style
          </label>
          <input
            type="text"
            value={config.tone}
            onChange={(e) => setConfig({ ...config, tone: e.target.value })}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
          />
        </div>

        <div>
          <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1">
            Focus Areas (comma-separated)
          </label>
          <input
            type="text"
            value={config.focus}
            onChange={(e) => setConfig({ ...config, focus: e.target.value })}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
          />
        </div>

        <div>
          <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1">
            Special Instructions (optional)
          </label>
          <textarea
            value={config.instructions}
            onChange={(e) =>
              setConfig({ ...config, instructions: e.target.value })
            }
            rows={3}
            placeholder="Extra guidance for this agent..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Config"}
          </button>
          {saved && (
            <span className="text-xs text-green-400">Config saved</span>
          )}
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-zinc-800">
        <div className="flex items-center gap-4">
          <button
            onClick={dispatch}
            disabled={dispatching || !config.active}
            className="px-4 py-2 text-sm font-medium rounded bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-50"
          >
            {dispatching
              ? `${config.id.toUpperCase()} is writing...`
              : `Send ${config.id.toUpperCase()} on Assignment`}
          </button>
          {!config.active && (
            <span className="text-xs text-red-400">
              Activate first
            </span>
          )}
        </div>
        {dispatchResult && (
          <p className="mt-3 text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded">
            {dispatchResult}
          </p>
        )}
      </div>
    </section>
  );
}
