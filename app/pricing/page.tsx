"use client";

import { useState } from "react";

const PRICE_PER_CALL = 0.00041;

const PACKS = [
  { idx: 0, amount: 100, label: "$1", calls: Math.floor(100 / (PRICE_PER_CALL * 100)) },
  { idx: 1, amount: 500, label: "$5", calls: Math.floor(500 / (PRICE_PER_CALL * 100)) },
  { idx: 2, amount: 1000, label: "$10", calls: Math.floor(1000 / (PRICE_PER_CALL * 100)) },
];

export default function PricingPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<number | null>(null);
  const [lookupEmail, setLookupEmail] = useState("");
  const [keyInfo, setKeyInfo] = useState<Record<string, unknown> | null>(null);
  const [lookupError, setLookupError] = useState("");

  const params = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : null;
  const success = params?.get("success");
  const successEmail = params?.get("email");

  async function buyPack(packIdx: number) {
    if (!email) return;
    setLoading(packIdx);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pack: packIdx, email }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
    setLoading(null);
  }

  async function lookupKey() {
    setKeyInfo(null);
    setLookupError("");
    const res = await fetch(`/api/billing/balance?email=${encodeURIComponent(lookupEmail)}`);
    const data = await res.json();
    if (res.ok) {
      setKeyInfo(data);
    } else {
      setLookupError(data.error || "Not found");
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      <header className="border-b border-zinc-800 px-6 py-6">
        <div className="max-w-3xl mx-auto flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-bold">The First Signal</h1>
            <p className="text-sm text-zinc-500 mt-1">API Pricing</p>
          </div>
          <a href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
            Back to wire
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {success && (
          <div className="mb-8 p-4 rounded-lg bg-green-900/30 border border-green-700 text-green-300">
            Payment successful. Your API key has been created/topped up.
            {successEmail && (
              <span> Look up your key below using <strong>{decodeURIComponent(successEmail)}</strong>.</span>
            )}
          </div>
        )}

        {/* Price */}
        <section className="mb-10">
          <div className="text-center mb-8">
            <p className="text-5xl font-bold text-green-400">$0.00041</p>
            <p className="text-zinc-400 mt-2">per API call</p>
            <p className="text-xs text-zinc-500 mt-1">
              1 free call per IP for discovery. Then pay-as-you-go.
            </p>
          </div>

          <div className="p-6 rounded-lg bg-zinc-900 border border-zinc-800">
            <p className="text-sm text-zinc-400 mb-3">Usage with API key:</p>
            <pre className="text-xs text-zinc-300 bg-zinc-950 p-3 rounded overflow-x-auto">{`curl -H "Authorization: Bearer tfs_YOUR_KEY" \\
  https://aiwire.mj41.me/api/stories`}</pre>
          </div>
        </section>

        {/* Buy Credits */}
        <section className="mb-10 p-6 rounded-lg bg-zinc-900 border border-zinc-800">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-4">
            Buy API Credits
          </h2>

          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded bg-zinc-950 border border-zinc-700 text-zinc-100 mb-4 focus:outline-none focus:border-green-500"
          />

          <div className="grid grid-cols-3 gap-4">
            {PACKS.map((pack) => (
              <button
                key={pack.idx}
                onClick={() => buyPack(pack.idx)}
                disabled={!email || loading !== null}
                className="p-4 rounded-lg border border-zinc-700 hover:border-green-500 bg-zinc-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <p className="text-2xl font-bold text-green-400">{pack.label}</p>
                <p className="text-xs text-zinc-400 mt-1">
                  {pack.calls.toLocaleString()} calls
                </p>
                {loading === pack.idx && (
                  <p className="text-xs text-yellow-400 mt-2">Redirecting...</p>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Look Up Key */}
        <section className="mb-10 p-6 rounded-lg bg-zinc-900 border border-zinc-800">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-4">
            Look Up Your API Key
          </h2>

          <div className="flex gap-2">
            <input
              type="email"
              placeholder="your@email.com"
              value={lookupEmail}
              onChange={(e) => setLookupEmail(e.target.value)}
              className="flex-1 px-4 py-3 rounded bg-zinc-950 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-green-500"
            />
            <button
              onClick={lookupKey}
              disabled={!lookupEmail}
              className="px-6 py-3 rounded bg-green-700 hover:bg-green-600 text-white font-semibold disabled:opacity-50"
            >
              Look Up
            </button>
          </div>

          {lookupError && (
            <p className="mt-3 text-sm text-red-400">{lookupError}</p>
          )}

          {keyInfo && (
            <div className="mt-4 p-4 rounded bg-zinc-950 border border-zinc-800">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-zinc-500">API Key</p>
                  <p className="font-mono text-green-400 break-all">{keyInfo.api_key as string}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Balance</p>
                  <p className="text-lg font-bold">{keyInfo.balance as string}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Calls Remaining</p>
                  <p className="font-mono">{(keyInfo.calls_remaining as number)?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Total Calls Made</p>
                  <p className="font-mono">{keyInfo.total_calls as number}</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* What You Get */}
        <section className="p-6 rounded-lg bg-zinc-900 border border-zinc-800">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-4">
            What You Get
          </h2>
          <ul className="space-y-2 text-sm text-zinc-300">
            <li>// 16 AI reporters across 13 beats</li>
            <li>// Structured JSON — headline, body, sources, confidence scores</li>
            <li>// Real-time commodities, stocks, AI, cyber, sports, weather</li>
            <li>// Conflict detection + source verification built in</li>
            <li>// OpenAPI spec at /.well-known/openapi.json</li>
            <li>// Agent-native — built for LLMs, not browsers</li>
          </ul>
        </section>

        <footer className="mt-10 text-center text-xs text-zinc-600">
          The First Signal — mj41, LLC
        </footer>
      </main>
    </div>
  );
}
