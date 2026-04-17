import { getAllMentors } from "@/lib/mentors";
import Link from "next/link";

export default function Home() {
  const mentors = getAllMentors();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      {/* Topbar */}
      <div className="mentor-topbar" style={{ position: "sticky" }}>
        <div className="breadcrumb">
          <span
            style={{
              color: "var(--text2)",
              fontFamily: "var(--font-m)",
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            Trade<span style={{ color: "var(--accent)" }}>Arcade</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Link
            href="/login"
            className="btn-outline btn-sm"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path
                d="M10 3L15 8l-5 5M15 8H2"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Login
          </Link>
          <Link href="/dashboard" className="btn-primary btn-sm" style={{ borderRadius: "8px" }}>
            Dashboard →
          </Link>
        </div>
      </div>

      {/* Hero */}
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "80px 40px 40px",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-m)",
            fontSize: "10px",
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: "var(--accent)",
            marginBottom: "16px",
          }}
        >
          — Gamified Trading Education
        </div>
        <h1
          style={{
            fontFamily: "var(--font-d)",
            fontWeight: 800,
            fontSize: "clamp(36px, 6vw, 64px)",
            color: "var(--text)",
            letterSpacing: "-.04em",
            lineHeight: 1,
            marginBottom: "20px",
          }}
        >
          Trade<span style={{ color: "var(--accent)" }}>Arcade</span>
        </h1>
        <p
          style={{
            fontFamily: "var(--font-b)",
            fontSize: "16px",
            color: "var(--text2)",
            lineHeight: 1.65,
            maxWidth: "540px",
            margin: "0 auto 40px",
          }}
        >
          Master your mentor&apos;s trading model through arcade-style games. Every question drawn
          from real content.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <Link href="/dashboard" className="btn-primary" style={{ borderRadius: "10px", fontSize: "13px" }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M10 3L15 8l-5 5M15 8H2"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Go to Dashboard
          </Link>
          <Link href="/login" className="btn-outline" style={{ borderRadius: "10px" }}>
            Sign In
          </Link>
        </div>
      </div>

      {/* Mentor Hubs */}
      {mentors.length > 0 && (
        <div
          style={{
            maxWidth: "900px",
            margin: "0 auto",
            padding: "0 40px 80px",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-m)",
              fontSize: "10px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--text3)",
              marginBottom: "16px",
              textAlign: "center",
            }}
          >
            Live Mentor Hubs
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "14px",
            }}
          >
            {mentors.map((m) => (
              <Link
                key={m.id}
                href={`/${m.id}`}
                className="mentor-hub-card"
              >
                <div
                  className="mentor-hub-avi"
                  style={{
                    background: `${m.branding.primaryColor}18`,
                    border: `1px solid ${m.branding.primaryColor}30`,
                    color: m.branding.primaryColor,
                  }}
                >
                  {m.displayName.charAt(0)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="mentor-hub-name">{m.displayName}</div>
                  <div className="mentor-hub-meta">
                    {m.terms.length} terms · {m.concepts.length} concepts
                  </div>
                </div>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text3)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  style={{ marginLeft: "auto", flexShrink: 0 }}
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
