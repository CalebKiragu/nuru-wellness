"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2, LogIn } from "lucide-react";

export function LoginForm({
  accounts,
  demoMode,
  demoPassword,
}: {
  accounts: { email: string; label: string }[];
  demoMode: boolean;
  demoPassword?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault();
    setLoading("password");
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not sign in.");
      router.push(json.redirect ?? "/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in.");
      setLoading(null);
    }
  }

  async function signInAs(accountEmail: string) {
    setLoading(accountEmail);
    setError("");
    try {
      const response = await fetch("/api/auth/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: accountEmail }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not open the demo.");
      router.push(json.redirect ?? "/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open the demo.");
      setLoading(null);
    }
  }

  return (
    <div>
      <form onSubmit={signInWithPassword} className="space-y-4">
        <div>
          <label className="dash-label" htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="dash-input min-h-12"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@studio.com"
            required
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="dash-label" htmlFor="password">Password</label>
            <span className="mb-1 text-[10px] text-muted">Demo: {demoPassword ?? "configured locally"}</span>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="dash-input min-h-12 pr-11"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted hover:text-ink"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && <p role="alert" className="rounded-md bg-[#FBEDE9] px-3 py-2 text-xs text-[#8f4332]">{error}</p>}

        <button
          type="submit"
          disabled={loading !== null}
          className="dash-btn dash-btn-primary min-h-12 w-full"
        >
          {loading === "password" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          Sign in
        </button>
      </form>

      {demoMode && accounts.length > 0 && (
        <div className="mt-7">
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">Or explore the demonstration</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="mt-4 space-y-2">
            {accounts.map((account) => (
              <button
                key={account.email}
                type="button"
                disabled={loading !== null}
                onClick={() => signInAs(account.email)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-paper px-3.5 py-2.5 text-left transition-colors hover:border-forest/30 hover:bg-white disabled:opacity-60"
              >
                <span>
                  <span className="block text-xs font-medium text-ink">{account.label}</span>
                  <span className="block text-[10px] text-muted">{account.email}</span>
                </span>
                {loading === account.email ? (
                  <Loader2 className="h-4 w-4 animate-spin text-forest" />
                ) : (
                  <ArrowRight className="h-4 w-4 text-forest" />
                )}
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-[10px] leading-relaxed text-muted">
            One-click access is enabled in demo mode only. It never bypasses server authentication.
          </p>
        </div>
      )}
    </div>
  );
}
