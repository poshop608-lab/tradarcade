import Link from "next/link";
import { notFound } from "next/navigation";
import { getMentor } from "@/lib/mentors";
import { GAMES } from "@/lib/games";
import { GameSlotGrid } from "@/components/game-slot-grid";

const GB_SPECIFIC_GAME_IDS = new Set(["gb-number-quiz", "ce-matching", "algo-sorter", "clockwise"]);

function hasGbGames(mentorId: string) {
  return mentorId === "gb-time";
}

export default async function MentorHub({
  params,
}: {
  params: Promise<{ mentorId: string }>;
}) {
  const { mentorId } = await params;
  const mentor = getMentor(mentorId);
  if (!mentor) notFound();

  // Default visible games — respects mentor's defaultActiveGameIds if set
  const defaultVisibleGames = GAMES.filter((g) => {
    if (mentor.defaultActiveGameIds) {
      return mentor.defaultActiveGameIds.includes(g.id);
    }
    if (GB_SPECIFIC_GAME_IDS.has(g.id)) return hasGbGames(mentorId);
    return true;
  });

  const gamesCount = defaultVisibleGames.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", position: "relative", zIndex: 1, background: "var(--bg)" }}>
      {/* Ambient orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      {/* TOPBAR */}
      <div className="mentor-topbar">
        <div className="breadcrumb">
          <Link href="/" style={{ color: "var(--text3)" }}>TradeArcade</Link>
          <span className="sep">/</span>
          <span className="current">{mentor.displayName}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: "10px", background: "var(--bg3)", border: "1px solid var(--border)" }}>
            <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--green)", boxShadow: "0 0 5px var(--green)", animation: "pulseDot 2s ease-in-out infinite" }} />
            <span style={{ fontFamily: "var(--font-m)", fontSize: "11px", color: "var(--green)" }}>{gamesCount} games live</span>
          </div>
          <Link
            href="/"
            className="btn-outline btn-sm"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            All Mentors
          </Link>
        </div>
      </div>

      {/* MENTOR HERO */}
      <div className="mentor-hero-section">
        <div className="mentor-hero-card">
          {/* Gradient top strip */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg, ${mentor.branding.primaryColor}, ${mentor.branding.accentColor})` }} />
          {/* Ambient glow */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "100px", background: `radial-gradient(ellipse at 50% 0%, ${mentor.branding.primaryColor}12 0%, transparent 70%)`, pointerEvents: "none" }} />
          <div className="mentor-hero-row">
            <div className="mentor-big-avi" style={{ background: `linear-gradient(135deg, ${mentor.branding.primaryColor}22, ${mentor.branding.accentColor}33)`, borderColor: mentor.branding.primaryColor + "30", color: mentor.branding.primaryColor }}>
              {mentor.displayName.charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mentor-hero-name">
                {mentor.displayName}
                <span className="tag tag-green">Live</span>
              </div>
              <div className="mentor-hero-model">
                {mentor.terms.length} terms · {mentor.concepts.length} concepts · {mentor.rules.length} rules
                {mentor.gbQuizItems ? ` · ${mentor.gbQuizItems.length} GB items` : ""}
              </div>
              <div className="mentor-hero-tagline">
                Drill {mentor.displayName}&apos;s exact trading model across {gamesCount} arcade-style games. Every question, every answer drawn from their real content. No generic quizzes.
              </div>
              <div className="mentor-hero-stats">
                <div><div className="mh-stat-val">{gamesCount}</div><div className="mh-stat-lbl">games live</div></div>
                <div><div className="mh-stat-val">{mentor.terms.length}</div><div className="mh-stat-lbl">terms</div></div>
                <div><div className="mh-stat-val">{mentor.concepts.length}</div><div className="mh-stat-lbl">concepts</div></div>
                <div><div className="mh-stat-val">{mentor.rules.length}</div><div className="mh-stat-lbl">rules</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="mentor-content">
        {/* Games grid */}
        <div>
          <GameSlotGrid
            mentorId={mentorId}
            defaultGames={defaultVisibleGames}
            allGames={GAMES}
            primaryColor={mentor.branding.primaryColor}
          />

          {/* Mastery section */}
          <div style={{ fontFamily: "var(--font-m)", fontSize: "10px", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text3)", margin: "24px 0 14px" }}>
            Model Overview
          </div>
          <div className="mastery-card">
            {mentor.terms.slice(0, 4).map((t, i) => {
              const pcts = [85, 78, 62, 91];
              const pct = pcts[i] ?? 75;
              const isWeak = pct < 70;
              return (
                <div key={t.term} className="mastery-item">
                  <div className="mastery-row">
                    <div className="mastery-label">
                      {t.term}
                      {isWeak && <span className="tag tag-amber" style={{ fontSize: "9px", padding: "1px 6px" }}>Weak spot</span>}
                    </div>
                    <div className="mastery-pct" style={{ color: isWeak ? "var(--amber)" : "var(--green)" }}>{pct}%</div>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: isWeak ? "linear-gradient(to right,#f0a500,#ffd166)" : undefined }} />
                  </div>
                  <div className="mastery-desc">{t.definition.slice(0, 70)}…</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div>
          {/* Progress */}
          <div className="sidebar-widget" style={{ marginBottom: "14px" }}>
            <div className="widget-header">
              <div className="widget-title">Your Progress</div>
            </div>
            <div className="progress-grid">
              {[["—", "sessions"], ["—%", "accuracy"], ["—d", "streak"], ["—", "badges"]].map(([val, lbl]) => (
                <div key={lbl} className="prog-stat">
                  <div className="prog-val" style={val.includes("%") ? { color: "var(--green)" } : val.includes("d") ? { color: "var(--amber)" } : {}}>{val}</div>
                  <div className="prog-lbl">{lbl}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: "0 14px 14px" }}>
              <div className="progress-bar" style={{ margin: "0 0 6px" }}>
                <div className="progress-fill" style={{ width: "0%" }} />
              </div>
              <div style={{ fontFamily: "var(--font-m)", fontSize: "10px", color: "var(--text3)" }}>Play games to track progress</div>
            </div>
          </div>

          {/* Top terms to learn */}
          <div className="sidebar-widget" style={{ marginBottom: "14px" }}>
            <div className="widget-header">
              <div className="widget-title">Key Terms</div>
              <div className="widget-badge">{mentor.terms.length} total</div>
            </div>
            {mentor.terms.slice(0, 5).map((t, i) => (
              <div key={t.term} className="mini-lb-row">
                <div className={`rank-badge ${i === 0 ? "r1" : i === 1 ? "r2" : i === 2 ? "r3" : "rn"}`}>{i + 1}</div>
                <div className="mini-name">{t.term}</div>
                <div className="mini-score" style={{ fontSize: "10px", color: "var(--text3)", fontFamily: "var(--font-m)" }}>
                  {t.definition.slice(0, 20)}…
                </div>
              </div>
            ))}
          </div>

          {/* Weekly challenge card */}
          <div className="challenge-card">
            <div className="challenge-title">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: "#ffd700" }}><path d="M8 2l1.5 3 3.5.5-2.5 2.5.6 3.5L8 10l-3.1 1.5.6-3.5L3 5.5l3.5-.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
              Weekly Challenge
            </div>
            <div className="challenge-sub">Coming soon</div>
            <p className="challenge-p">Compete with other {mentor.displayName} students on the same set of questions. Top players earn community badges.</p>
            <div className="challenge-meta">
              <span style={{ fontFamily: "var(--font-m)", fontSize: "11px", color: "var(--text3)" }}>Launching soon</span>
              <span style={{ fontFamily: "var(--font-m)", fontSize: "11px", color: "var(--amber)" }}>Stay tuned</span>
            </div>
            <button className="challenge-btn">Get Notified</button>
          </div>
        </div>
      </div>
    </div>
  );
}
