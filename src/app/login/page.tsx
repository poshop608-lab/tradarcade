"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Check if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!email.trim() || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);

    if (mode === "signup") {
      const { error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: displayName.trim() || email.split("@")[0] },
        },
      });
      if (err) {
        setError(err.message);
        setLoading(false);
      } else {
        setInfo("Check your email for a confirmation link, then sign in.");
        setMode("signin");
        setPassword("");
        setLoading(false);
      }
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) {
        setError(err.message);
        setLoading(false);
      } else {
        router.push("/dashboard");
      }
    }
  }

  return (
    <>
      <style>{`
        @keyframes floatA {
          0%,100%{transform:translateY(0) scale(1)}
          50%{transform:translateY(-28px) scale(1.04)}
        }
        @keyframes floatB {
          0%,100%{transform:translateY(0) scale(1)}
          50%{transform:translateY(22px) scale(.97)}
        }
        @keyframes fadeUp {
          from{opacity:0;transform:translateY(18px)}
          to{opacity:1;transform:translateY(0)}
        }
        .login-wrap {
          min-height: 100vh;
          background: #07080a;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          position: relative;
          overflow: hidden;
          font-family: var(--font-geist-sans, system-ui, sans-serif);
        }
        .l-orb {
          position: fixed;
          border-radius: 50%;
          pointer-events: none;
          filter: blur(90px);
          mix-blend-mode: screen;
        }
        .l-orb-1 {
          width: 700px; height: 700px;
          background: radial-gradient(circle, rgba(34,211,238,.22) 0%, transparent 65%);
          top: -250px; right: -180px;
          animation: floatA 12s ease-in-out infinite;
        }
        .l-orb-2 {
          width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(168,85,247,.16) 0%, transparent 65%);
          bottom: -200px; left: -150px;
          animation: floatB 15s ease-in-out infinite;
        }
        .l-orb-3 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(244,63,94,.1) 0%, transparent 65%);
          top: 45%; right: 8%;
          animation: floatA 18s ease-in-out 3s infinite;
        }
        .l-grid {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image: radial-gradient(circle, rgba(255,255,255,.045) 1px, transparent 1px);
          background-size: 32px 32px;
          mask-image: radial-gradient(ellipse 70% 70% at 50% 50%, black 0%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 70% 70% at 50% 50%, black 0%, transparent 100%);
        }
        .l-card {
          width: 100%;
          max-width: 440px;
          position: relative;
          z-index: 1;
          animation: fadeUp .5s ease both;
        }
        .l-brand {
          text-align: center;
          margin-bottom: 2rem;
        }
        .l-logo {
          display: inline-flex;
          align-items: center;
          gap: .6rem;
          margin-bottom: .6rem;
        }
        .l-logo-icon {
          width: 44px; height: 44px;
          background: linear-gradient(135deg, rgba(34,211,238,.2), rgba(168,85,247,.2));
          border: 1px solid rgba(34,211,238,.3);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.25rem;
        }
        .l-logo-text {
          font-size: 1.6rem;
          font-weight: 800;
          letter-spacing: -.03em;
          background: linear-gradient(135deg, #67e8f9, #a78bfa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .l-tagline {
          color: #525866;
          font-size: .875rem;
        }
        .l-box {
          background: rgba(14,16,20,.85);
          border: 1px solid rgba(255,255,255,.09);
          border-radius: 20px;
          padding: 2rem;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 32px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04) inset;
          position: relative;
          overflow: hidden;
        }
        .l-box::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(34,211,238,.4), transparent);
        }
        .l-tabs {
          display: flex;
          gap: 2px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 10px;
          padding: 3px;
          margin-bottom: 1.75rem;
        }
        .l-tab {
          flex: 1;
          padding: .5rem;
          border-radius: 7px;
          border: none;
          font-size: .85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all .2s;
          background: none;
          color: #525866;
          font-family: inherit;
        }
        .l-tab.active {
          background: rgba(34,211,238,.12);
          color: #67e8f9;
          border: 1px solid rgba(34,211,238,.25);
        }
        .l-field {
          display: flex;
          flex-direction: column;
          gap: .45rem;
          margin-bottom: 1rem;
        }
        .l-label {
          font-size: .75rem;
          font-weight: 600;
          color: #9aa0ad;
          text-transform: uppercase;
          letter-spacing: .07em;
        }
        .l-input-wrap {
          position: relative;
        }
        .l-input {
          width: 100%;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.09);
          border-radius: 10px;
          padding: .75rem 1rem;
          color: #f0f2f5;
          font-size: .9rem;
          font-family: inherit;
          outline: none;
          transition: border-color .2s, box-shadow .2s;
          box-sizing: border-box;
        }
        .l-input:focus {
          border-color: rgba(34,211,238,.4);
          box-shadow: 0 0 0 3px rgba(34,211,238,.08);
        }
        .l-input::placeholder { color: #525866; }
        .l-input.has-toggle { padding-right: 3rem; }
        .l-eye {
          position: absolute;
          right: .875rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #525866;
          padding: .25rem;
          display: flex;
          align-items: center;
          transition: color .15s;
        }
        .l-eye:hover { color: #9aa0ad; }
        .l-error {
          background: rgba(244,63,94,.08);
          border: 1px solid rgba(244,63,94,.25);
          border-radius: 10px;
          padding: .65rem 1rem;
          color: #f43f5e;
          font-size: .8125rem;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: .5rem;
        }
        .l-info {
          background: rgba(34,197,94,.08);
          border: 1px solid rgba(34,197,94,.25);
          border-radius: 10px;
          padding: .65rem 1rem;
          color: #22c55e;
          font-size: .8125rem;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: .5rem;
        }
        .l-btn {
          width: 100%;
          padding: .875rem;
          background: linear-gradient(135deg, #22d3ee, #818cf8);
          border: none;
          border-radius: 10px;
          color: #07080a;
          font-size: .9375rem;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: opacity .2s, transform .15s;
          margin-top: .25rem;
          letter-spacing: -.01em;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: .5rem;
        }
        .l-btn:hover { opacity: .88; transform: translateY(-1px); }
        .l-btn:active { transform: translateY(0); }
        .l-btn:disabled { opacity: .6; cursor: not-allowed; transform: none; }
        .l-divider {
          display: flex;
          align-items: center;
          gap: .75rem;
          margin: 1.25rem 0;
          color: #525866;
          font-size: .75rem;
        }
        .l-divider::before, .l-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,.07);
        }
        .l-footer {
          text-align: center;
          margin-top: 1.5rem;
          color: #525866;
          font-size: .75rem;
        }
        .l-spin {
          width: 16px; height: 16px;
          border: 2px solid rgba(0,0,0,.3);
          border-top-color: #07080a;
          border-radius: 50%;
          animation: spin .7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="login-wrap">
        <div className="l-orb l-orb-1" />
        <div className="l-orb l-orb-2" />
        <div className="l-orb l-orb-3" />
        <div className="l-grid" />

        <div className="l-card">
          {/* Brand */}
          <div className="l-brand">
            <div className="l-logo">
              <div className="l-logo-icon">🎮</div>
              <span className="l-logo-text">TradArcade</span>
            </div>
            <p className="l-tagline">
              {mode === "signin" ? "Welcome back. Let's get trading." : "Create your account to start playing."}
            </p>
          </div>

          {/* Card */}
          <div className="l-box">
            {/* Tabs */}
            <div className="l-tabs">
              <button
                className={`l-tab${mode === "signin" ? " active" : ""}`}
                onClick={() => { setMode("signin"); setError(""); setInfo(""); }}
                type="button"
              >
                Sign In
              </button>
              <button
                className={`l-tab${mode === "signup" ? " active" : ""}`}
                onClick={() => { setMode("signup"); setError(""); setInfo(""); }}
                type="button"
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Display name (signup only) */}
              {mode === "signup" && (
                <div className="l-field">
                  <label className="l-label" htmlFor="displayName">Display Name</label>
                  <input
                    id="displayName"
                    className="l-input"
                    type="text"
                    placeholder="Your name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    autoComplete="name"
                    disabled={loading}
                    maxLength={40}
                  />
                </div>
              )}

              {/* Email */}
              <div className="l-field">
                <label className="l-label" htmlFor="email">Email</label>
                <input
                  id="email"
                  className="l-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  disabled={loading}
                />
              </div>

              {/* Password */}
              <div className="l-field">
                <label className="l-label" htmlFor="password">Password</label>
                <div className="l-input-wrap">
                  <input
                    id="password"
                    className="l-input has-toggle"
                    type={showPassword ? "text" : "password"}
                    placeholder={mode === "signup" ? "Min 6 characters" : "Your password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="l-eye"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Error / Info */}
              {error && (
                <div className="l-error">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 3.5h1.5v5h-1.5v-5zm0 6h1.5v1.5h-1.5V10.5z"/>
                  </svg>
                  {error}
                </div>
              )}
              {info && (
                <div className="l-info">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 9.5l-2.5-2.5 1.06-1.06 1.44 1.44 3.19-3.19 1.06 1.06-4.25 4.25z"/>
                  </svg>
                  {info}
                </div>
              )}

              {/* Submit */}
              <button type="submit" className="l-btn" disabled={loading}>
                {loading ? (
                  <><div className="l-spin" /> {mode === "signin" ? "Signing in…" : "Creating account…"}</>
                ) : mode === "signin" ? (
                  <>Enter Arcade <span>→</span></>
                ) : (
                  <>Create Account <span>→</span></>
                )}
              </button>
            </form>

            {/* Forgot password (sign in mode) */}
            {mode === "signin" && (
              <>
                <div className="l-divider">or</div>
                <button
                  type="button"
                  onClick={async () => {
                    if (!email.trim()) { setError("Enter your email first."); return; }
                    setLoading(true);
                    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim());
                    setLoading(false);
                    if (err) setError(err.message);
                    else setInfo("Password reset email sent. Check your inbox.");
                  }}
                  style={{
                    width: "100%",
                    padding: ".7rem",
                    background: "rgba(255,255,255,.04)",
                    border: "1px solid rgba(255,255,255,.08)",
                    borderRadius: 10,
                    color: "#9aa0ad",
                    fontSize: ".875rem",
                    fontFamily: "inherit",
                    cursor: "pointer",
                    transition: "all .2s",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.borderColor = "rgba(34,211,238,.3)")}
                  onMouseOut={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.08)")}
                >
                  Forgot password?
                </button>
              </>
            )}
          </div>

          {/* Bottom note */}
          <p className="l-footer">
            No credit card · Progress saved automatically
          </p>
        </div>
      </div>
    </>
  );
}
