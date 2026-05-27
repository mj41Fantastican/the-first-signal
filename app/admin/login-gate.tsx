"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginGate({ children }: { children: React.ReactNode }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.refresh();
    } else {
      setError("Wrong password");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <form onSubmit={handleLogin} className="w-full max-w-sm p-8 rounded-lg bg-zinc-900 border border-zinc-800">
        <h1 className="text-xl font-bold text-zinc-100 mb-1">The First Signal</h1>
        <p className="text-sm text-zinc-500 mb-6">Admin access required</p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full px-4 py-3 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono"
          autoFocus
        />

        {error && (
          <p className="text-red-400 text-sm mt-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full mt-4 px-4 py-3 rounded bg-green-700 hover:bg-green-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium transition-colors"
        >
          {loading ? "..." : "Log In"}
        </button>
      </form>
    </div>
  );
}
