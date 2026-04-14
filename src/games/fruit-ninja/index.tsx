"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { MentorConfig } from "@/lib/types";
import { recordSession } from "@/lib/stats";
import { getSettings } from "@/lib/settings";

interface FlyingItem {
  id: number;
  label: string;
  isValid: boolean;
  explanation?: string;
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  slashed: boolean;
  slashTime: number;
  halfLeftX: number; halfLeftY: number;
  halfRightX: number; halfRightY: number;
  halfVxL: number; halfVyL: number;
  halfVxR: number; halfVyR: number;
  spawnTime: number;
}

interface TrailPoint { x: number; y: number; time: number; }

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; color: string; r: number;
}

type GameState = "start" | "playing" | "gameover";

const CANVAS_W = 800;
const CANVAS_H = 600;
const GRAVITY = 0.15;
const ITEM_RADIUS = 40;
const VALID_POINTS = 10;
const BOMB_PENALTY = 15;
const MAX_LIVES = 3;
const TRAIL_LIFETIME = 250;
const SLASH_DISPLAY_TIME = 500;

export default function FruitNinjaGame({ config }: { config: MentorConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef(getSettings());

  const state = useRef({
    gameState: "start" as GameState,
    score: 0,
    lives: MAX_LIVES,
    combo: 0,
    comboText: "",
    comboShowTime: 0,
    items: [] as FlyingItem[],
    trail: [] as TrailPoint[],
    particles: [] as Particle[],
    mouseDown: false,
    mouseX: 0,
    mouseY: 0,
    lastSpawnTime: 0,
    spawnInterval: 1400,
    nextId: 0,
    startTime: 0,
    elapsed: 0,
    swipeSlashedIds: new Set<number>(),
    accuracy: { slashed: 0, correct: 0 },
  });

  const [uiState, setUiState] = useState<GameState>("start");

  // Static stars
  const starsRef = useRef(
    Array.from({ length: 70 }, () => ({
      x: Math.random() * CANVAS_W,
      y: Math.random() * CANVAS_H,
      r: Math.random() * 1.4 + 0.3,
      a: Math.random() * 0.5 + 0.15,
      twinkle: Math.random() * Math.PI * 2,
    }))
  );
  const tickRef = useRef(0);

  const pickConcept = useCallback(() => {
    const c = config.concepts;
    return c[Math.floor(Math.random() * c.length)];
  }, [config.concepts]);

  const spawnItem = useCallback(() => {
    const s = state.current;
    const concept = pickConcept();
    const startX = 120 + Math.random() * (CANVAS_W - 240);
    const targetX = CANVAS_W / 2 + (Math.random() - 0.5) * 320;
    const travelTime = 60;
    const vx = (targetX - startX) / travelTime;
    const vy = -(7.5 + Math.random() * 3.5);
    s.items.push({
      id: s.nextId++,
      label: concept.label,
      isValid: concept.isValid,
      explanation: concept.explanation,
      x: startX,
      y: CANVAS_H + ITEM_RADIUS,
      vx, vy, radius: ITEM_RADIUS,
      slashed: false, slashTime: 0,
      halfLeftX: 0, halfLeftY: 0,
      halfRightX: 0, halfRightY: 0,
      halfVxL: 0, halfVyL: 0,
      halfVxR: 0, halfVyR: 0,
      spawnTime: performance.now(),
    });
  }, [pickConcept]);

  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = state.current;
    if (s.gameState !== "playing") return;

    const GAME_DURATION = settingsRef.current["fruit-ninja"].durationSeconds * 1000;
    const now = performance.now();
    s.elapsed = now - s.startTime;
    if (s.elapsed >= GAME_DURATION) {
      s.gameState = "gameover";
      recordSession({
        gameId: "fruit-ninja",
        gameName: "Fruit Ninja",
        mentorId: config.id,
        timestamp: Date.now(),
        durationMs: s.elapsed,
        score: s.score,
        accuracy: s.accuracy.slashed > 0 ? s.accuracy.correct / s.accuracy.slashed : undefined,
      });
      setUiState("gameover");
      return;
    }

    const progress = s.elapsed / GAME_DURATION;
    s.spawnInterval = Math.max(450, 1400 - progress * 950);


    if (now - s.lastSpawnTime > s.spawnInterval) {
      spawnItem();
      if (progress > 0.3 && Math.random() < progress * 0.55) spawnItem();
      s.lastSpawnTime = now;
    }

    // Update items
    for (let i = s.items.length - 1; i >= 0; i--) {
      const item = s.items[i];
      if (item.slashed) {
        item.halfLeftX += item.halfVxL; item.halfLeftY += item.halfVyL;
        item.halfRightX += item.halfVxR; item.halfRightY += item.halfVyR;
        item.halfVyL += GRAVITY; item.halfVyR += GRAVITY;
        if (now - item.slashTime > 900) s.items.splice(i, 1);
      } else {
        item.x += item.vx; item.vy += GRAVITY; item.y += item.vy;
        if (item.y > CANVAS_H + ITEM_RADIUS * 2) s.items.splice(i, 1);
      }
    }

    // Update particles
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.08;
      p.life -= 0.04;
      if (p.life <= 0) s.particles.splice(i, 1);
    }

    // Prune trail
    s.trail = s.trail.filter((p: TrailPoint) => now - p.time < TRAIL_LIFETIME);

    // ── DRAW ──
    tickRef.current++;
    const t = tickRef.current;

    // Deep space gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    bgGrad.addColorStop(0, "#030308");
    bgGrad.addColorStop(0.5, "#060610");
    bgGrad.addColorStop(1, "#0a0a18");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Ambient green glow (bottom center)
    const ambGrad = ctx.createRadialGradient(CANVAS_W / 2, CANVAS_H + 100, 10, CANVAS_W / 2, CANVAS_H + 100, CANVAS_H * 0.75);
    ambGrad.addColorStop(0, "rgba(29,185,124,0.08)");
    ambGrad.addColorStop(1, "transparent");
    ctx.fillStyle = ambGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Stars with twinkling
    for (const star of starsRef.current) {
      const twinkle = 0.5 + Math.sin(t * 0.03 + star.twinkle) * 0.5;
      ctx.globalAlpha = star.a * twinkle;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Subtle grid
    ctx.strokeStyle = "rgba(255,255,255,0.02)";
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_W; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
    }
    for (let y = 0; y < CANVAS_H; y += 32) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
    }

    // Timer bar (bottom) — modern pill shape
    const timeLeft = Math.max(0, 1 - s.elapsed / GAME_DURATION);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(0, CANVAS_H - 4, CANVAS_W, 4);
    const barGrad = ctx.createLinearGradient(0, 0, CANVAS_W * timeLeft, 0);
    barGrad.addColorStop(0, "#1DB97C");
    barGrad.addColorStop(0.5, "#22c55e");
    barGrad.addColorStop(1, "#3B82F6");
    ctx.fillStyle = barGrad;
    ctx.shadowColor = "#1DB97C";
    ctx.shadowBlur = 8;
    ctx.fillRect(0, CANVAS_H - 4, CANVAS_W * timeLeft, 4);
    ctx.shadowBlur = 0;

    // Items
    for (const item of s.items) {
      if (item.slashed) {
        const age = now - item.slashTime;
        const alpha = Math.max(0, 1 - age / 900);
        const flashColor = item.isValid ? "#1DB97C" : "#EF4444";
        const flashColorBright = item.isValid ? "#34d399" : "#f87171";

        // Left half — glossy sliced orb
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(item.halfLeftX, item.halfLeftY, item.radius, Math.PI * 0.5, Math.PI * 1.5);
        ctx.closePath();
        const lGrad = ctx.createRadialGradient(item.halfLeftX - item.radius * 0.3, item.halfLeftY - item.radius * 0.3, 1, item.halfLeftX, item.halfLeftY, item.radius);
        lGrad.addColorStop(0, flashColorBright);
        lGrad.addColorStop(0.6, flashColor);
        lGrad.addColorStop(1, `${flashColor}88`);
        ctx.fillStyle = lGrad;
        ctx.shadowColor = flashColor;
        ctx.shadowBlur = 20 * alpha;
        ctx.fill();
        ctx.restore();

        // Right half
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(item.halfRightX, item.halfRightY, item.radius, -Math.PI * 0.5, Math.PI * 0.5);
        ctx.closePath();
        const rGrad = ctx.createRadialGradient(item.halfRightX + item.radius * 0.1, item.halfRightY - item.radius * 0.3, 1, item.halfRightX, item.halfRightY, item.radius);
        rGrad.addColorStop(0, flashColorBright);
        rGrad.addColorStop(0.6, flashColor);
        rGrad.addColorStop(1, `${flashColor}88`);
        ctx.fillStyle = rGrad;
        ctx.shadowColor = flashColor;
        ctx.shadowBlur = 20 * alpha;
        ctx.fill();
        ctx.restore();

        // Juice splatter line
        if (age < 200) {
          ctx.save();
          ctx.globalAlpha = (1 - age / 200) * alpha * 0.6;
          ctx.strokeStyle = flashColorBright;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(item.halfLeftX, item.halfLeftY);
          ctx.lineTo(item.halfRightX, item.halfRightY);
          ctx.stroke();
          ctx.restore();
        }

        if (age < SLASH_DISPLAY_TIME) {
          ctx.save();
          ctx.globalAlpha = alpha * alpha;
          ctx.fillStyle = flashColorBright;
          ctx.shadowColor = flashColor;
          ctx.shadowBlur = 12;
          ctx.font = "bold 20px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const pts = item.isValid ? `+${VALID_POINTS}` : `-${BOMB_PENALTY}`;
          ctx.fillText(pts, (item.halfLeftX + item.halfRightX) / 2, Math.min(item.halfLeftY, item.halfRightY) - item.radius - 14);
          ctx.restore();
        }
      } else {
        const r = item.radius;
        const accentColor = item.isValid ? "#1DB97C" : "#EF4444";
        const accentBright = item.isValid ? "#34d399" : "#f87171";

        // Outer glow
        ctx.shadowColor = accentColor;
        ctx.shadowBlur = 14;

        // 3D glossy sphere body
        const grad = ctx.createRadialGradient(item.x - r * 0.3, item.y - r * 0.35, r * 0.05, item.x, item.y, r);
        grad.addColorStop(0, accentBright);
        grad.addColorStop(0.35, accentColor);
        grad.addColorStop(0.75, `${accentColor}cc`);
        grad.addColorStop(1, "#050510");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(item.x, item.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Inner dark area (depth)
        const innerGrad = ctx.createRadialGradient(item.x + r * 0.15, item.y + r * 0.15, r * 0.1, item.x + r * 0.2, item.y + r * 0.2, r * 0.65);
        innerGrad.addColorStop(0, "transparent");
        innerGrad.addColorStop(1, "rgba(0,0,0,0.45)");
        ctx.fillStyle = innerGrad;
        ctx.beginPath();
        ctx.arc(item.x, item.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Specular highlight (top-left bright spot)
        const specGrad = ctx.createRadialGradient(item.x - r * 0.28, item.y - r * 0.32, 0, item.x - r * 0.2, item.y - r * 0.25, r * 0.45);
        specGrad.addColorStop(0, "rgba(255,255,255,0.65)");
        specGrad.addColorStop(0.4, "rgba(255,255,255,0.2)");
        specGrad.addColorStop(1, "transparent");
        ctx.fillStyle = specGrad;
        ctx.beginPath();
        ctx.arc(item.x, item.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Small secondary highlight
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.beginPath();
        ctx.arc(item.x + r * 0.35, item.y + r * 0.3, r * 0.12, 0, Math.PI * 2);
        ctx.fill();

        // Border ring
        ctx.strokeStyle = `${accentBright}55`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(item.x, item.y, r - 0.75, 0, Math.PI * 2);
        ctx.stroke();

        // Label text — centered, readable
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 4;
        const words = item.label.split(" ");
        const maxW = r * 1.65;
        if (item.label.length > 12 && words.length > 1) {
          ctx.font = "bold 10px system-ui, sans-serif";
          const mid = Math.ceil(words.length / 2);
          ctx.fillText(words.slice(0, mid).join(" "), item.x, item.y - 7, maxW);
          ctx.fillText(words.slice(mid).join(" "), item.x, item.y + 7, maxW);
        } else {
          ctx.font = "bold 11px system-ui, sans-serif";
          ctx.fillText(item.label, item.x, item.y, maxW);
        }
        ctx.shadowBlur = 0;
      }
    }

    // Particles
    for (const p of s.particles) {
      ctx.globalAlpha = p.life * p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Slash trail — dramatic multi-layer
    if (s.trail.length > 1) {
      // Outer glow layer
      for (let i = 1; i < s.trail.length; i++) {
        const p0 = s.trail[i - 1];
        const p1 = s.trail[i];
        const age = now - p1.time;
        const alpha = Math.max(0, 1 - age / TRAIL_LIFETIME);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.strokeStyle = `rgba(29,185,124,${alpha * 0.3})`;
        ctx.lineWidth = alpha * 14 + 2;
        ctx.lineCap = "round";
        ctx.shadowColor = "#1DB97C";
        ctx.shadowBlur = 12;
        ctx.stroke();
      }
      // Core bright layer
      for (let i = 1; i < s.trail.length; i++) {
        const p0 = s.trail[i - 1];
        const p1 = s.trail[i];
        const age = now - p1.time;
        const alpha = Math.max(0, 1 - age / TRAIL_LIFETIME);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        const trailGrad = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
        trailGrad.addColorStop(0, `rgba(52,211,153,${alpha * 0.7})`);
        trailGrad.addColorStop(1, `rgba(255,255,255,${alpha})`);
        ctx.strokeStyle = trailGrad;
        ctx.lineWidth = alpha * 4 + 1;
        ctx.lineCap = "round";
        ctx.shadowBlur = 0;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    // HUD — modern frosted panels
    // Score panel (top left)
    ctx.fillStyle = "rgba(10,10,20,0.7)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 100, 48, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#1DB97C";
    ctx.font = "bold 22px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(String(s.score), 18, 15);
    ctx.fillStyle = "#888888";
    ctx.font = "7px monospace";
    ctx.letterSpacing = "0.1em";
    ctx.fillText("SCORE", 18, 44);
    ctx.letterSpacing = "0";

    // Timer panel (top center)
    const secsLeft = Math.max(0, Math.ceil((GAME_DURATION - s.elapsed) / 1000));
    ctx.fillStyle = "rgba(10,10,20,0.7)";
    ctx.beginPath();
    ctx.roundRect(CANVAS_W / 2 - 36, 10, 72, 44, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.stroke();
    ctx.fillStyle = secsLeft < 10 ? "#EF4444" : "#ffffff";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`${secsLeft}s`, CANVAS_W / 2, 16);
    ctx.fillStyle = "#888888";
    ctx.font = "7px monospace";
    ctx.letterSpacing = "0.1em";
    ctx.fillText("TIME", CANVAS_W / 2, 40);
    ctx.letterSpacing = "0";

    // Lives panel (top right) — colored dots
    ctx.fillStyle = "rgba(10,10,20,0.7)";
    ctx.beginPath();
    ctx.roundRect(CANVAS_W - 120, 10, 110, 48, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.stroke();
    ctx.fillStyle = "#888888";
    ctx.font = "7px monospace";
    ctx.letterSpacing = "0.1em";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("LIVES", CANVAS_W - 65, 14);
    ctx.letterSpacing = "0";
    for (let i = 0; i < MAX_LIVES; i++) {
      const dotX = CANVAS_W - 100 + i * 30;
      const dotY = 34;
      if (i < s.lives) {
        ctx.shadowColor = "#EF4444";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#EF4444";
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(239,68,68,0.2)";
      }
      ctx.beginPath();
      ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Combo text
    if (s.comboText && now - s.comboShowTime < 1200) {
      const alpha = Math.max(0, 1 - (now - s.comboShowTime) / 1200);
      const scale = 1 + (1 - alpha) * 0.4;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(CANVAS_W / 2, CANVAS_H / 2 - 80);
      ctx.scale(scale, scale);
      ctx.shadowColor = "#F59E0B";
      ctx.shadowBlur = 25;
      ctx.fillStyle = "#F59E0B";
      ctx.font = "bold 38px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.comboText, 0, 0);
      // Outline
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1.5;
      ctx.strokeText(s.comboText, 0, 0);
      ctx.restore();
    }

    requestAnimationFrame(loop);
  }, [spawnItem]);

  // Slash detection
  const checkSlash = useCallback((mx: number, my: number) => {
    const s = state.current;
    if (s.gameState !== "playing") return;

    for (const item of s.items) {
      if (item.slashed || s.swipeSlashedIds.has(item.id)) continue;
      const dx = mx - item.x, dy = my - item.y;
      if (Math.sqrt(dx * dx + dy * dy) < item.radius + 8) {
        item.slashed = true;
        item.slashTime = performance.now();
        item.halfLeftX = item.x; item.halfLeftY = item.y;
        item.halfRightX = item.x; item.halfRightY = item.y;
        item.halfVxL = item.vx - 2.5; item.halfVyL = item.vy - 1.5;
        item.halfVxR = item.vx + 2.5; item.halfVyR = item.vy - 1.5;
        s.swipeSlashedIds.add(item.id);
        s.accuracy.slashed++;

        const color = item.isValid ? "#1DB97C" : "#EF4444";
        for (let i = 0; i < 8; i++) {
          const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.3;
          const spd = 2 + Math.random() * 3;
          s.particles.push({
            x: item.x, y: item.y,
            vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 2,
            life: 1, color, r: 3 + Math.random() * 2,
          });
        }

        if (item.isValid) {
          s.combo++;
          s.accuracy.correct++;
          let points = VALID_POINTS;
          if (s.combo >= 2) {
            const mult = Math.min(s.combo, 5);
            points = VALID_POINTS * mult;
            s.comboText = `${s.combo}x COMBO  +${points}`;
            s.comboShowTime = performance.now();
          }
          s.score += points;
        } else {
          s.score = Math.max(0, s.score - BOMB_PENALTY);
          s.lives--;
          s.combo = 0;
          if (s.lives <= 0) {
            s.gameState = "gameover";
            recordSession({
              gameId: "fruit-ninja",
              gameName: "Fruit Ninja",
              mentorId: config.id,
              timestamp: Date.now(),
              durationMs: s.elapsed,
              score: s.score,
              accuracy: s.accuracy.slashed > 0 ? s.accuracy.correct / s.accuracy.slashed : undefined,
            });
            setUiState("gameover");
          }
        }
      }
    }
  }, []);

  const getCanvasPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }, []);

  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const s = state.current;
    s.mouseDown = true;
    s.swipeSlashedIds = new Set();
    s.combo = 0;
    const pos = getCanvasPos(e);
    s.mouseX = pos.x; s.mouseY = pos.y;
    s.trail.push({ x: pos.x, y: pos.y, time: performance.now() });
    checkSlash(pos.x, pos.y);
  }, [getCanvasPos, checkSlash]);

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const s = state.current;
    const pos = getCanvasPos(e);
    s.mouseX = pos.x; s.mouseY = pos.y;
    if (s.gameState === "playing") {
      s.trail.push({ x: pos.x, y: pos.y, time: performance.now() });
      checkSlash(pos.x, pos.y);
    }
  }, [getCanvasPos, checkSlash]);

  const handlePointerUp = useCallback(() => {
    state.current.mouseDown = false;
    state.current.combo = 0;
  }, []);

  const startGame = useCallback(() => {
    settingsRef.current = getSettings();
    const s = state.current;
    s.gameState = "playing";
    s.score = 0; s.lives = MAX_LIVES; s.combo = 0;
    s.comboText = ""; s.comboShowTime = 0;
    s.items = []; s.trail = []; s.particles = [];
    s.mouseDown = false;
    s.lastSpawnTime = performance.now();
    s.spawnInterval = 1400; s.nextId = 0;
    s.startTime = performance.now(); s.elapsed = 0;
    s.swipeSlashedIds = new Set();
    s.accuracy = { slashed: 0, correct: 0 };
    setUiState("playing");
    requestAnimationFrame(loop);
  }, [loop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#030308";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }, []);

  const s = state.current;

  return (
    <div className="relative w-full max-w-[800px] aspect-[4/3]">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="w-full h-full rounded-xl border border-card-border cursor-crosshair touch-none"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      />

      {uiState === "start" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#030308]/88 rounded-xl gap-4">
          <div className="w-16 h-16 rounded-2xl bg-card border border-card-border flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L13.5 9H21L15 13.5L17.5 21L12 16.5L6.5 21L9 13.5L3 9H10.5L12 2Z" fill="#1DB97C" stroke="#34d399" strokeWidth="0.5"/>
            </svg>
          </div>
          <h2 className="text-3xl font-black text-foreground uppercase tracking-wide">Fruit Ninja</h2>
          <p className="text-muted text-center max-w-xs leading-relaxed text-sm">
            Swipe through <span className="text-green font-semibold">valid</span> concepts to score.{" "}
            <span className="text-red font-semibold">Invalid</span> ones cost you a life!
          </p>
          <button
            onClick={startGame}
            className="mt-2 px-10 py-3 bg-green text-white font-bold rounded-xl hover:opacity-90 transition-opacity uppercase tracking-wide text-sm"
          >
            Start Game
          </button>
        </div>
      )}

      {uiState === "gameover" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#030308]/90 rounded-xl gap-4">
          <h2 className="text-3xl font-black text-foreground uppercase tracking-wide">Game Over</h2>
          <div className="bg-card rounded-2xl border border-card-border px-10 py-6 text-center space-y-3">
            <div>
              <div className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">Score</div>
              <div className="text-5xl font-black font-mono text-green">{s.score}</div>
            </div>
            <div className="flex gap-6 justify-center">
              <div>
                <div className="text-[10px] font-mono text-muted uppercase tracking-widest">Accuracy</div>
                <div className="text-xl font-black text-foreground">
                  {s.accuracy.slashed > 0
                    ? `${Math.round((s.accuracy.correct / s.accuracy.slashed) * 100)}%`
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-muted uppercase tracking-widest">Slashed</div>
                <div className="text-xl font-black text-foreground">{s.accuracy.slashed}</div>
              </div>
            </div>
          </div>
          <button
            onClick={startGame}
            className="px-10 py-3 bg-green text-white font-bold rounded-xl hover:opacity-90 transition-opacity uppercase tracking-wide text-sm"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
