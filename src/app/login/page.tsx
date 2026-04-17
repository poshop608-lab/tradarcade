"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Mode = "signin" | "signup" | "confirm";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  // Real-time confirmation polling: fires when user clicks their email link
  useEffect(() => {
    if (mode !== "confirm") return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session) {
        if (pollRef.current) clearInterval(pollRef.current);
        router.replace("/dashboard");
      }
    });

    pollRef.current = setInterval(async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        if (pollRef.current) clearInterval(pollRef.current);
        router.replace("/dashboard");
      }
    }, 2500);

    return () => {
      subscription.unsubscribe();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [mode, router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) { setError("Please fill in all fields."); return; }
    setLoading(true);

    if (mode === "signup") {
      const { error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: displayName.trim() || email.split("@")[0] } },
      });
      if (err) {
        setError(err.message);
        setLoading(false);
      } else {
        setConfirmEmail(email.trim());
        setLoading(false);
        setMode("confirm");
      }
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(), password,
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
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        @keyframes floatA { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-28px) scale(1.04)} }
        @keyframes floatB { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(22px) scale(.97)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes scanLine { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
        @keyframes dot1 { 0%,80%,100%{transform:scale(0);opacity:0} 40%{transform:scale(1);opacity:1} }
        @keyframes dot2 { 0%,20%,80%,100%{transform:scale(0);opacity:0} 50%{transform:scale(1);opacity:1} }
        @keyframes dot3 { 0%,40%,80%,100%{transform:scale(0);opacity:0} 60%{transform:scale(1);opacity:1} }
        @keyframes emailBounce { 0%,100%{transform:translateY(0)} 40%{transform:translateY(-8px)} 60%{transform:translateY(-4px)} }

        * { box-sizing:border-box; }

        .lp {
          min-height:100vh;
          background:#07080a;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:1.5rem;
          position:relative;
          overflow:hidden;
          font-family:'Plus Jakarta Sans', var(--font-jakarta), system-ui, sans-serif;
        }

        /* orbs */
        .lp-orb { position:fixed; border-radius:50%; pointer-events:none; filter:blur(90px); mix-blend-mode:screen; }
        .lp-orb-1 { width:700px;height:700px;background:radial-gradient(circle,rgba(34,211,238,.2) 0%,transparent 65%);top:-260px;right:-180px;animation:floatA 13s ease-in-out infinite; }
        .lp-orb-2 { width:600px;height:600px;background:radial-gradient(circle,rgba(168,85,247,.14) 0%,transparent 65%);bottom:-200px;left:-150px;animation:floatB 16s ease-in-out infinite; }
        .lp-orb-3 { width:380px;height:380px;background:radial-gradient(circle,rgba(244,63,94,.09) 0%,transparent 65%);top:45%;right:8%;animation:floatA 19s ease-in-out 3s infinite; }

        /* grid */
        .lp-grid {
          position:fixed;inset:0;pointer-events:none;z-index:0;
          background-image:radial-gradient(circle,rgba(255,255,255,.04) 1px,transparent 1px);
          background-size:32px 32px;
          mask-image:radial-gradient(ellipse 70% 70% at 50% 50%,black 0%,transparent 100%);
          -webkit-mask-image:radial-gradient(ellipse 70% 70% at 50% 50%,black 0%,transparent 100%);
        }

        /* back button */
        .lp-back {
          position:fixed; top:20px; left:20px; z-index:10;
          display:inline-flex; align-items:center; gap:7px;
          padding:8px 16px; border-radius:10px;
          background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.09);
          color:#9aa0ad; font-size:12.5px; font-weight:600;
          text-decoration:none; transition:all .18s;
          font-family:inherit;
          backdrop-filter:blur(10px);
        }
        .lp-back:hover { background:rgba(255,255,255,.09); border-color:rgba(34,211,238,.25); color:#22d3ee; }

        /* card */
        .lp-card { width:100%; max-width:440px; position:relative; z-index:1; animation:fadeUp .5s ease both; }

        /* brand */
        .lp-brand { text-align:center; margin-bottom:2rem; }
        .lp-logo { display:inline-flex; align-items:center; gap:.65rem; margin-bottom:.5rem; }
        .lp-logo-icon {
          width:46px; height:46px;
          background:linear-gradient(135deg,rgba(34,211,238,.2),rgba(168,85,247,.18));
          border:1px solid rgba(34,211,238,.32);
          border-radius:13px;
          display:flex; align-items:center; justify-content:center;
          box-shadow:0 0 18px rgba(34,211,238,.2), 0 0 6px rgba(34,211,238,.1) inset;
        }
        .lp-logo-text {
          font-size:1.65rem; font-weight:800; letter-spacing:-.035em;
          background:linear-gradient(115deg,#67e8f9 20%,#a5b4fc 80%);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
        }
        .lp-tagline { color:#525866; font-size:.85rem; font-weight:500; }

        /* box */
        .lp-box {
          background:rgba(12,14,18,.88);
          border:1px solid rgba(255,255,255,.09);
          border-radius:22px; padding:2rem;
          backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px);
          box-shadow:0 32px 80px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.04) inset;
          position:relative; overflow:hidden;
        }
        .lp-box::before {
          content:''; position:absolute; top:0; left:0; right:0; height:1px;
          background:linear-gradient(90deg,transparent,rgba(34,211,238,.45),rgba(129,140,248,.3),transparent);
        }

        /* tabs */
        .lp-tabs { display:flex; gap:2px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07); border-radius:11px; padding:3px; margin-bottom:1.75rem; }
        .lp-tab {
          flex:1; padding:.5rem; border-radius:8px; border:none;
          font-size:.85rem; font-weight:700; cursor:pointer; transition:all .2s;
          background:none; color:#525866; font-family:inherit;
        }
        .lp-tab.on { background:rgba(34,211,238,.12); color:#67e8f9; border:1px solid rgba(34,211,238,.25); }

        /* field */
        .lp-field { display:flex; flex-direction:column; gap:.45rem; margin-bottom:1rem; }
        .lp-label { font-size:.72rem; font-weight:700; color:#9aa0ad; text-transform:uppercase; letter-spacing:.08em; }
        .lp-input-wrap { position:relative; display:flex; align-items:center; }
        .lp-input-icon {
          position:absolute; left:13px; top:50%; transform:translateY(-50%);
          color:#3f3f46; pointer-events:none; display:flex;
        }
        .lp-input {
          width:100%; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.09);
          border-radius:11px; padding:.75rem 1rem .75rem 2.75rem;
          color:#f0f2f5; font-size:.9rem; font-family:inherit; outline:none;
          transition:border-color .2s, box-shadow .2s; box-sizing:border-box;
          font-weight:500;
        }
        .lp-input:focus { border-color:rgba(34,211,238,.45); box-shadow:0 0 0 3px rgba(34,211,238,.09), 0 0 12px rgba(34,211,238,.05); }
        .lp-input::placeholder { color:#3f3f46; }
        .lp-input.pw { padding-right:3rem; }
        .lp-eye {
          position:absolute; right:.875rem; top:50%; transform:translateY(-50%);
          background:none; border:none; cursor:pointer; color:#525866; padding:.25rem;
          display:flex; align-items:center; transition:color .15s;
        }
        .lp-eye:hover { color:#9aa0ad; }

        /* error */
        .lp-err { background:rgba(244,63,94,.08); border:1px solid rgba(244,63,94,.25); border-radius:11px; padding:.65rem 1rem; color:#f43f5e; font-size:.8rem; margin-bottom:1rem; display:flex; align-items:center; gap:.5rem; font-weight:500; }

        /* submit */
        .lp-btn {
          width:100%; padding:.9rem; border:none; border-radius:11px;
          color:#07080a; font-size:.9375rem; font-weight:800; font-family:inherit;
          cursor:pointer; transition:opacity .2s, transform .15s; margin-top:.25rem;
          letter-spacing:-.01em; display:flex; align-items:center; justify-content:center; gap:.5rem;
          background:linear-gradient(135deg,#22d3ee,#818cf8);
          box-shadow:0 0 20px rgba(34,211,238,.2);
        }
        .lp-btn:hover { opacity:.88; transform:translateY(-1px); }
        .lp-btn:active { transform:translateY(0); }
        .lp-btn:disabled { opacity:.6; cursor:not-allowed; transform:none; }

        /* divider */
        .lp-div { display:flex; align-items:center; gap:.75rem; margin:1.25rem 0; color:#525866; font-size:.72rem; font-weight:600; }
        .lp-div::before,.lp-div::after { content:''; flex:1; height:1px; background:rgba(255,255,255,.07); }

        /* forgot pw */
        .lp-forgot {
          width:100%; padding:.7rem; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08);
          border-radius:11px; color:#9aa0ad; font-size:.875rem; font-family:inherit;
          cursor:pointer; transition:all .2s; font-weight:600;
        }
        .lp-forgot:hover { border-color:rgba(34,211,238,.3); color:#22d3ee; }

        /* spinner */
        .lp-spin { width:16px;height:16px;border:2px solid rgba(0,0,0,.3);border-top-color:#07080a;border-radius:50%;animation:spin .7s linear infinite; }

        /* footer */
        .lp-foot { text-align:center; margin-top:1.5rem; color:#525866; font-size:.75rem; }

        /* ── CONFIRM SCREEN ── */
        .lp-confirm {
          text-align:center; padding:1rem 0;
        }
        .lp-confirm-icon {
          width:72px; height:72px; border-radius:20px; margin:0 auto 1.25rem;
          background:linear-gradient(135deg,rgba(34,211,238,.12),rgba(129,140,248,.1));
          border:1px solid rgba(34,211,238,.25);
          display:flex; align-items:center; justify-content:center;
          box-shadow:0 0 24px rgba(34,211,238,.15);
          animation:emailBounce 3s ease-in-out infinite;
        }
        .lp-confirm-h { font-size:1.2rem; font-weight:800; color:#fafafa; letter-spacing:-.02em; margin-bottom:.5rem; }
        .lp-confirm-s { font-size:.85rem; color:#71717a; line-height:1.6; margin-bottom:1.5rem; font-weight:500; }
        .lp-confirm-email {
          display:inline-flex; align-items:center; gap:.5rem;
          padding:.5rem 1rem; border-radius:10px;
          background:rgba(34,211,238,.07); border:1px solid rgba(34,211,238,.18);
          color:#67e8f9; font-size:.85rem; font-weight:700;
          margin-bottom:1.5rem; letter-spacing:-.01em;
        }
        .lp-live {
          display:flex; align-items:center; justify-content:center; gap:.5rem;
          font-size:.78rem; color:#71717a; font-weight:600; margin-bottom:1.5rem;
        }
        .lp-live-dot {
          width:7px; height:7px; border-radius:50%; background:#22d3ee;
          animation:pulse 1.4s ease-in-out infinite;
          box-shadow:0 0 6px rgba(34,211,238,.5);
        }
        .lp-dots { display:inline-flex; gap:4px; align-items:center; margin-left:2px; }
        .lp-dots span { width:5px; height:5px; border-radius:50%; background:#52525b; display:block; }
        .lp-dots span:nth-child(1) { animation:dot1 1.2s infinite; }
        .lp-dots span:nth-child(2) { animation:dot2 1.2s infinite; }
        .lp-dots span:nth-child(3) { animation:dot3 1.2s infinite; }
        .lp-scan {
          height:2px; border-radius:1px; overflow:hidden; margin-bottom:1.5rem;
          background:rgba(255,255,255,.05);
        }
        .lp-scan-bar {
          height:100%; width:40%; border-radius:1px;
          background:linear-gradient(90deg,transparent,#22d3ee,transparent);
          animation:scanLine 2s ease-in-out infinite;
        }
        .lp-back-signin {
          background:none; border:none; color:#525866; font-size:.8rem; font-family:inherit;
          cursor:pointer; font-weight:600; transition:color .15s; padding:.4rem;
        }
        .lp-back-signin:hover { color:#9aa0ad; }
      `}</style>

      <div className="lp">
        <div className="lp-orb lp-orb-1" />
        <div className="lp-orb lp-orb-2" />
        <div className="lp-orb lp-orb-3" />
        <div className="lp-grid" />

        {/* Back to landing */}
        <a href="/tradegame.html" className="lp-back">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M5 12l7-7M5 12l7 7"/></svg>
          Back to Home
        </a>

        <div className="lp-card">

          {/* Brand */}
          <div className="lp-brand">
            <div className="lp-logo">
              <div className="lp-logo-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2 14 6 9 9 12 13 6 17 10 22 5"/>
                  <line x1="2" y1="20" x2="22" y2="20" strokeOpacity=".3"/>
                </svg>
              </div>
              <span className="lp-logo-text">TradeArcade</span>
            </div>
            <p className="lp-tagline">
              {mode === "confirm"
                ? "Almost there — check your inbox"
                : mode === "signin"
                  ? "Welcome back. Let's get trading."
                  : "Create your account to start playing."}
            </p>
          </div>

          {/* Card */}
          <div className="lp-box">

            {/* ── CONFIRM EMAIL SCREEN ── */}
            {mode === "confirm" ? (
              <div className="lp-confirm">
                <div className="lp-confirm-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <div className="lp-confirm-h">Confirm your email</div>
                <p className="lp-confirm-s">
                  We sent a confirmation link to:
                </p>
                <div className="lp-confirm-email">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  {confirmEmail}
                </div>

                <div className="lp-scan"><div className="lp-scan-bar" /></div>

                <div className="lp-live">
                  <span className="lp-live-dot" />
                  Watching for confirmation in real-time
                  <span className="lp-dots"><span /><span /><span /></span>
                </div>

                <p style={{ fontSize:".78rem", color:"#3f3f46", lineHeight:1.6, marginBottom:"1.25rem", fontWeight:500 }}>
                  Click the link in your email — you'll be signed in automatically.
                  <br/>No need to reload this page.
                </p>

                <button
                  type="button"
                  className="lp-back-signin"
                  onClick={() => { setMode("signin"); setError(""); }}
                >
                  ← Back to sign in
                </button>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="lp-tabs">
                  <button className={`lp-tab${mode==="signin"?" on":""}`} onClick={() => { setMode("signin"); setError(""); }} type="button">
                    Sign In
                  </button>
                  <button className={`lp-tab${mode==="signup"?" on":""}`} onClick={() => { setMode("signup"); setError(""); }} type="button">
                    Sign Up
                  </button>
                </div>

                <form onSubmit={handleSubmit}>
                  {/* Display name */}
                  {mode === "signup" && (
                    <div className="lp-field">
                      <label className="lp-label" htmlFor="dn">Display Name</label>
                      <div className="lp-input-wrap">
                        <span className="lp-input-icon">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </span>
                        <input id="dn" className="lp-input" type="text" placeholder="Your name" value={displayName}
                          onChange={e => setDisplayName(e.target.value)} autoComplete="name" disabled={loading} maxLength={40} />
                      </div>
                    </div>
                  )}

                  {/* Email */}
                  <div className="lp-field">
                    <label className="lp-label" htmlFor="em">Email</label>
                    <div className="lp-input-wrap">
                      <span className="lp-input-icon">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                      </span>
                      <input id="em" className="lp-input" type="email" placeholder="you@example.com" value={email}
                        onChange={e => setEmail(e.target.value)} autoComplete="email" autoFocus disabled={loading} />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="lp-field">
                    <label className="lp-label" htmlFor="pw">Password</label>
                    <div className="lp-input-wrap">
                      <span className="lp-input-icon">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                      </span>
                      <input id="pw" className="lp-input pw" type={showPassword ? "text" : "password"}
                        placeholder={mode === "signup" ? "Min 6 characters" : "Your password"} value={password}
                        onChange={e => setPassword(e.target.value)}
                        autoComplete={mode === "signup" ? "new-password" : "current-password"} disabled={loading} />
                      <button type="button" className="lp-eye" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                        {showPassword ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="lp-err">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {error}
                    </div>
                  )}

                  <button type="submit" className="lp-btn" disabled={loading}>
                    {loading
                      ? <><div className="lp-spin" />{mode === "signin" ? "Signing in…" : "Creating account…"}</>
                      : mode === "signin"
                        ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="2 14 6 9 9 12 13 6 17 10 22 5"/></svg>Enter Arcade</>
                        : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>Create Account</>
                    }
                  </button>
                </form>

                {mode === "signin" && (
                  <>
                    <div className="lp-div">or</div>
                    <button
                      type="button"
                      className="lp-forgot"
                      onClick={async () => {
                        if (!email.trim()) { setError("Enter your email first."); return; }
                        setLoading(true);
                        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim());
                        setLoading(false);
                        if (err) setError(err.message);
                        else setError(""); // clear error, show success via state
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginRight:5, verticalAlign:"middle" }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                      Forgot password?
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          <p className="lp-foot">No credit card · Progress saved automatically</p>
        </div>
      </div>
    </>
  );
}
