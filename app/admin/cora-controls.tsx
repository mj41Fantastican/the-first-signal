"use client";

import { useState } from "react";

interface CoraConfig {
  id: string;
  display_name: string;
  beat: string;
  tone: string;
  focus: string;
  instructions: string;
  active: boolean;
  updated_at: string;
}

export default function CoraControls({ initial }: { initial: CoraConfig }) {
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
    const res = await fetch("/api/cora", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setDispatchResult(`Filed: "${data.story.headline}"`);
    } else {
      setDispatchResult(`Error: ${data.error}`);
    }
    setDispatching(false);
  }

  return (
    <section className="mb-10 p-6 rounded-lg bg-zinc-900 border border-zinc-800">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          CORA — Agent Controls
        </h2>
        <div className="flex items-center gap-3">
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
            Special Instructions (optional — extra guidance for CORA)
          </label>
          <textarea
            value={config.instructions}
            onChange={(e) =>
              setConfig({ ...config, instructions: e.target.value })
            }
            rows={3}
            placeholder="e.g. Focus on Chile mining strikes this week, or mention RWACu token if relevant..."
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

      {/* Dispatch */}
      <div className="mt-6 pt-6 border-t border-zinc-800">
        <div className="flex items-center gap-4">
          <button
            onClick={dispatch}
            disabled={dispatching || !config.active}
            className="px-4 py-2 text-sm font-medium rounded bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-50"
          >
            {dispatching ? "CORA is writing..." : "Send CORA on Assignment"}
          </button>
          {!config.active && (
            <span className="text-xs text-red-400">
              Activate CORA first
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
