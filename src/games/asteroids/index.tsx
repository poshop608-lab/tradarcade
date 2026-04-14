"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { MentorConfig } from "@/lib/types";
import { recordSession, getSessions } from "@/lib/stats";
import { getSettings, saveSettings } from "@/lib/settings";

interface AsteroidsProps { config: MentorConfig; }

interface Asteroid {
  id: number; x: number; y: number; width: number; height: number;
  speed: number; label: string; isValid: boolean; explanation?: string;
  wobble: number; wobbleSpeed: number;
}
interface Bullet { x: number; y: number; speed: number; trail: { x: number; y: number }[]; }
interface Explosion { x: number; y: number; label: string; explanation: string; correct: boolean; timer: number; particles: { vx: number; vy: number; r: number; color: string }[]; }
interface ThrustParticle { x: number; y: number; vx: number; vy: number; life: number; }

type GameState = "start" | "playing" | "over";

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 700;
const SHIP_WIDTH = 34;
const SHIP_HEIGHT = 38;
const BULLET_SPEED = 8;
const ASTEROID_BASE_SPEED = 1.2;
const ASTEROID_WIDTH = 130;
const ASTEROID_HEIGHT = 60;
const SPAWN_INTERVAL_BASE = 1400;
const WAVE_SIZE = 10;

const DIFFICULTY_SPEED: Record<"easy" | "normal" | "hard", number> = { easy: 0.6, normal: 1.0, hard: 1.6 };
const DIFFICULTY_SPAWN: Record<"easy" | "normal" | "hard", number> = { easy: 1.6, normal: 1.0, hard: 0.55 };

export default function AsteroidsGame({ config }: AsteroidsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState>("start");
  const shipXRef = useRef(CANVAS_WIDTH / 2);
  const asteroidsRef = useRef<Asteroid[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const thrustParticlesRef = useRef<ThrustParticle[]>([]);
  const keysRef = useRef<Set<string>>(new Set());
  const autoFireFrameRef = useRef(0); // frames since last auto-fire shot
  const AUTO_FIRE_COOLDOWN = 8; // fire every N frames when space held
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const waveRef = useRef(1);
  const totalSpawnedRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const nextIdRef = useRef(0);
  const rafRef = useRef<number>(0);
  const sessionStartRef = useRef(0);
  const shakeRef = useRef(0);
  const settingsRef = useRef(getSettings());

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [wave, setWave] = useState(1);
  const [gameState, setGameState] = useState<GameState>("start");
  const [asteroidDifficulty, setAsteroidDifficulty] = useState<"easy" | "normal" | "hard">(() => getSettings().asteroids.difficulty);

  // Star layers for parallax
  const starsRef = useRef([
    Array.from({ length: 60 }, () => ({ x: Math.random() * CANVAS_WIDTH, y: Math.random() * CANVAS_HEIGHT, r: 0.4 + Math.random() * 0.8, a: 0.3 + Math.random() * 0.5, twinkle: Math.random() * Math.PI * 2, speed: 0.1 })),
    Array.from({ length: 30 }, () => ({ x: Math.random() * CANVAS_WIDTH, y: Math.random() * CANVAS_HEIGHT, r: 0.8 + Math.random() * 1.2, a: 0.5 + Math.random() * 0.4, twinkle: Math.random() * Math.PI * 2, speed: 0.18 })),
    Array.from({ length: 12 }, () => ({ x: Math.random() * CANVAS_WIDTH, y: Math.random() * CANVAS_HEIGHT, r: 1.2 + Math.random() * 1.8, a: 0.7 + Math.random() * 0.3, twinkle: Math.random() * Math.PI * 2, speed: 0.3 })),
  ]);

  const pickConcept = useCallback(() => {
    const c = config.concepts;
    return c.length ? c[Math.floor(Math.random() * c.length)] : { label: "N/A", isValid: true, explanation: "" };
  }, [config.concepts]);

  const spawnAsteroid = useCallback(() => {
    const concept = pickConcept();
    const x = Math.random() * (CANVAS_WIDTH - ASTEROID_WIDTH) + ASTEROID_WIDTH / 2;
    const waveMult = 1 + (waveRef.current - 1) * 0.15;
    const diffMult = DIFFICULTY_SPEED[settingsRef.current.asteroids.difficulty];
    asteroidsRef.current.push({
      id: nextIdRef.current++, x, y: -ASTEROID_HEIGHT,
      width: ASTEROID_WIDTH, height: ASTEROID_HEIGHT,
      speed: ASTEROID_BASE_SPEED * waveMult * diffMult + Math.random() * 0.4,
      label: concept.label, isValid: concept.isValid, explanation: concept.explanation,
      wobble: Math.random() * Math.PI * 2, wobbleSpeed: 0.03 + Math.random() * 0.02,
    });
    totalSpawnedRef.current++;
    if (totalSpawnedRef.current % WAVE_SIZE === 0) { waveRef.current++; setWave(waveRef.current); }
  }, [pickConcept]);

  const resetGame = useCallback(() => {
    shipXRef.current = CANVAS_WIDTH / 2;
    asteroidsRef.current = []; bulletsRef.current = []; explosionsRef.current = []; thrustParticlesRef.current = [];
    scoreRef.current = 0; livesRef.current = 3; waveRef.current = 1;
    totalSpawnedRef.current = 0; lastSpawnRef.current = 0; nextIdRef.current = 0; shakeRef.current = 0;
    setScore(0); setLives(3); setWave(1);
  }, []);

  const startGame = useCallback(() => {
    settingsRef.current = getSettings();
    resetGame();
    sessionStartRef.current = performance.now();
    gameStateRef.current = "playing";
    setGameState("playing");
  }, [resetGame]);

  const endGame = useCallback(() => {
    gameStateRef.current = "over";
    recordSession({ gameId: "asteroids", gameName: "Asteroids", mentorId: config.id, timestamp: Date.now(), durationMs: performance.now() - sessionStartRef.current, score: scoreRef.current });
    setGameState("over");
  }, [config.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);

    const handleClick = (e: MouseEvent) => {
      if (gameStateRef.current !== "playing") return;
      const rect = canvas.getBoundingClientRect();
      const cx = (e.clientX - rect.left) * (CANVAS_WIDTH / rect.width);
      const cy = (e.clientY - rect.top) * (CANVAS_HEIGHT / rect.height);
      for (let i = asteroidsRef.current.length - 1; i >= 0; i--) {
        const a = asteroidsRef.current[i];
        if (cx >= a.x - a.width / 2 && cx <= a.x + a.width / 2 && cy >= a.y - a.height / 2 && cy <= a.y + a.height / 2) {
          hitAsteroid(a, i); return;
        }
      }
      bulletsRef.current.push({ x: shipXRef.current, y: CANVAS_HEIGHT - SHIP_HEIGHT - 14, speed: BULLET_SPEED, trail: [] });
    };

    function hitAsteroid(a: Asteroid, i: number) {
      asteroidsRef.current.splice(i, 1);
      const correct = !a.isValid; // correct = shot an invalid concept
      if (correct) {
        scoreRef.current += 10;
        setScore(scoreRef.current);
      } else {
        // Wrong hit: lose a life and deduct score
        scoreRef.current -= 10;
        setScore(scoreRef.current);
        livesRef.current--;
        setLives(livesRef.current);
        shakeRef.current = 10;
        if (livesRef.current <= 0) { endGame(); return; }
      }
      const color = correct ? "#1DB97C" : "#EF4444";
      const particles = Array.from({ length: 12 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const spd = 1.5 + Math.random() * 3;
        return { vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd, r: 2 + Math.random() * 3, color };
      });
      explosionsRef.current.push({ x: a.x, y: a.y, label: a.label, explanation: a.explanation || (correct ? "Correct! Invalid concept." : "Wrong! That was valid."), correct, timer: 90, particles });
    }

    function spawnThrust() {
      const sx = shipXRef.current;
      const sy = CANVAS_HEIGHT - 16;
      for (let i = 0; i < 2; i++) {
        thrustParticlesRef.current.push({
          x: sx + (Math.random() - 0.5) * 10,
          y: sy,
          vx: (Math.random() - 0.5) * 1.5,
          vy: 1.5 + Math.random() * 2,
          life: 1,
        });
      }
    }

    function update(now: number) {
      if (gameStateRef.current !== "playing") return;
      const shipSpeed = 5;
      const moving = keysRef.current.has("ArrowLeft") || keysRef.current.has("a") || keysRef.current.has("A") || keysRef.current.has("ArrowRight") || keysRef.current.has("d") || keysRef.current.has("D");
      if (keysRef.current.has("ArrowLeft") || keysRef.current.has("a") || keysRef.current.has("A"))
        shipXRef.current = Math.max(SHIP_WIDTH / 2 + 10, shipXRef.current - shipSpeed);
      if (keysRef.current.has("ArrowRight") || keysRef.current.has("d") || keysRef.current.has("D"))
        shipXRef.current = Math.min(CANVAS_WIDTH - SHIP_WIDTH / 2 - 10, shipXRef.current + shipSpeed);
      if (moving) spawnThrust();

      // Continuous auto-fire when spacebar held
      if (keysRef.current.has(" ") || keysRef.current.has("Spacebar")) {
        autoFireFrameRef.current++;
        if (autoFireFrameRef.current >= AUTO_FIRE_COOLDOWN) {
          autoFireFrameRef.current = 0;
          bulletsRef.current.push({ x: shipXRef.current, y: CANVAS_HEIGHT - SHIP_HEIGHT - 14, speed: BULLET_SPEED, trail: [] });
        }
      } else {
        autoFireFrameRef.current = AUTO_FIRE_COOLDOWN; // ready to fire immediately on next press
      }

      const diffSpawnMult = DIFFICULTY_SPAWN[settingsRef.current.asteroids.difficulty];
      const spawnInterval = Math.max(400, (SPAWN_INTERVAL_BASE - (waveRef.current - 1) * 80) * diffSpawnMult);
      if (now - lastSpawnRef.current > spawnInterval) { spawnAsteroid(); lastSpawnRef.current = now; }

      // Update asteroids (move first so collision uses updated positions)
      for (let i = asteroidsRef.current.length - 1; i >= 0; i--) {
        const a = asteroidsRef.current[i];
        a.y += a.speed;
        a.wobble += a.wobbleSpeed;
      }

      // Update bullets + check collision (swept: test both old and new bullet position)
      for (let i = bulletsRef.current.length - 1; i >= 0; i--) {
        const b = bulletsRef.current[i];
        const prevY = b.y;
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 8) b.trail.shift();
        b.y -= b.speed;
        if (b.y < -10) { bulletsRef.current.splice(i, 1); continue; }

        // Check against every asteroid at BOTH old and new bullet position
        let bulletHit = false;
        for (let j = asteroidsRef.current.length - 1; j >= 0; j--) {
          const a = asteroidsRef.current[j];
          const left = a.x - a.width / 2 - 6;
          const right = a.x + a.width / 2 + 6;
          const top = a.y - a.height / 2 - 6;
          const bottom = a.y + a.height / 2 + 6;
          const inX = b.x >= left && b.x <= right;
          // Swept: check if bullet path (prevY → b.y) crosses the asteroid vertically
          const minY = Math.min(prevY, b.y);
          const maxY = Math.max(prevY, b.y);
          if (inX && maxY >= top && minY <= bottom) {
            bulletsRef.current.splice(i, 1);
            hitAsteroid(a, j);
            bulletHit = true;
            break;
          }
        }
        if (bulletHit) continue;
      }

      // Remove off-screen asteroids / apply miss penalty
      for (let i = asteroidsRef.current.length - 1; i >= 0; i--) {
        const a = asteroidsRef.current[i];
        if (a.y > CANVAS_HEIGHT + a.height) {
          asteroidsRef.current.splice(i, 1);
          if (!a.isValid) {
            livesRef.current--; setLives(livesRef.current); scoreRef.current -= 5; setScore(scoreRef.current); shakeRef.current = 10;
            if (livesRef.current <= 0) { endGame(); return; }
          } else { scoreRef.current += 5; setScore(scoreRef.current); }
        }
      }

      // Update thrust particles
      for (let i = thrustParticlesRef.current.length - 1; i >= 0; i--) {
        const p = thrustParticlesRef.current[i];
        p.x += p.vx; p.y += p.vy; p.life -= 0.07;
        if (p.life <= 0) thrustParticlesRef.current.splice(i, 1);
      }

      // Update explosions
      for (let i = explosionsRef.current.length - 1; i >= 0; i--) {
        explosionsRef.current[i].timer--;
        const ex = explosionsRef.current[i];
        for (const p of ex.particles) { p.vx *= 0.95; p.vy *= 0.95; }
        if (ex.timer <= 0) explosionsRef.current.splice(i, 1);
      }

      if (shakeRef.current > 0) shakeRef.current -= 0.5;
    }

    function drawBg() {
      if (!ctx) return;
      // Deep space gradient
      const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      bg.addColorStop(0, "#04060f");
      bg.addColorStop(0.5, "#080d1a");
      bg.addColorStop(1, "#050810");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Nebula glow
      const neb1 = ctx.createRadialGradient(CANVAS_WIDTH * 0.2, CANVAS_HEIGHT * 0.3, 0, CANVAS_WIDTH * 0.2, CANVAS_HEIGHT * 0.3, 200);
      neb1.addColorStop(0, "rgba(29,185,124,0.04)");
      neb1.addColorStop(1, "transparent");
      ctx.fillStyle = neb1;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      const neb2 = ctx.createRadialGradient(CANVAS_WIDTH * 0.8, CANVAS_HEIGHT * 0.6, 0, CANVAS_WIDTH * 0.8, CANVAS_HEIGHT * 0.6, 160);
      neb2.addColorStop(0, "rgba(59,130,246,0.04)");
      neb2.addColorStop(1, "transparent");
      ctx.fillStyle = neb2;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Stars with parallax
      for (const layer of starsRef.current) {
        for (const s of layer) {
          s.twinkle += 0.025;
          ctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(s.twinkle));
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    function drawShip() {
      if (!ctx) return;
      const sx = shipXRef.current;
      const sy = CANVAS_HEIGHT - 22;

      // Thrust particles
      for (const p of thrustParticlesRef.current) {
        ctx.globalAlpha = p.life * 0.8;
        const pGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 6 * p.life);
        pGrad.addColorStop(0, "#F59E0B");
        pGrad.addColorStop(0.5, "#EF4444");
        pGrad.addColorStop(1, "transparent");
        ctx.fillStyle = pGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6 * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Ship glow aura
      const aura = ctx.createRadialGradient(sx, sy - SHIP_HEIGHT / 2, 0, sx, sy - SHIP_HEIGHT / 2, 40);
      aura.addColorStop(0, "rgba(29,185,124,0.12)");
      aura.addColorStop(1, "transparent");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(sx, sy - SHIP_HEIGHT / 2, 40, 0, Math.PI * 2);
      ctx.fill();

      // Ship body gradient
      const shipGrad = ctx.createLinearGradient(sx - SHIP_WIDTH / 2, sy - SHIP_HEIGHT, sx + SHIP_WIDTH / 2, sy);
      shipGrad.addColorStop(0, "#2dd98f");
      shipGrad.addColorStop(0.5, "#1DB97C");
      shipGrad.addColorStop(1, "#0d7a4e");
      ctx.shadowColor = "#1DB97C";
      ctx.shadowBlur = 18;
      ctx.fillStyle = shipGrad;
      ctx.beginPath();
      ctx.moveTo(sx, sy - SHIP_HEIGHT);
      ctx.lineTo(sx - SHIP_WIDTH / 2, sy);
      ctx.lineTo(sx - SHIP_WIDTH * 0.15, sy - SHIP_HEIGHT * 0.3);
      ctx.lineTo(sx, sy - SHIP_HEIGHT * 0.15);
      ctx.lineTo(sx + SHIP_WIDTH * 0.15, sy - SHIP_HEIGHT * 0.3);
      ctx.lineTo(sx + SHIP_WIDTH / 2, sy);
      ctx.closePath();
      ctx.fill();

      // Ship highlight
      ctx.strokeStyle = "rgba(200,255,230,0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy - SHIP_HEIGHT + 2);
      ctx.lineTo(sx - SHIP_WIDTH * 0.25, sy - SHIP_HEIGHT * 0.45);
      ctx.stroke();

      // Engine glow
      ctx.shadowColor = "#F59E0B";
      ctx.shadowBlur = 14;
      const engGrad = ctx.createLinearGradient(sx - 6, sy - 8, sx + 6, sy + 4);
      engGrad.addColorStop(0, "#F59E0B");
      engGrad.addColorStop(1, "rgba(239,68,68,0.2)");
      ctx.fillStyle = engGrad;
      ctx.beginPath();
      ctx.ellipse(sx, sy - 4, 5, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    function drawBullets() {
      if (!ctx) return;
      for (const b of bulletsRef.current) {
        // Trail
        for (let i = 0; i < b.trail.length - 1; i++) {
          const alpha = (i / b.trail.length) * 0.5;
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = "#1DB97C";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(b.trail[i].x, b.trail[i].y);
          ctx.lineTo(b.trail[i + 1].x, b.trail[i + 1].y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // Bullet head
        ctx.shadowColor = "#1DB97C";
        ctx.shadowBlur = 12;
        const bGrad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 5);
        bGrad.addColorStop(0, "#ffffff");
        bGrad.addColorStop(0.4, "#1DB97C");
        bGrad.addColorStop(1, "transparent");
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    function drawAsteroids() {
      if (!ctx) return;
      for (const a of asteroidsRef.current) {
        const ax = a.x - a.width / 2;
        const ay = a.y - a.height / 2;
        const wobbleX = Math.sin(a.wobble) * 2;
        const r = 12;
        const isValid = a.isValid;
        const borderColor = isValid ? "#3B82F6" : "#EF4444";
        const glowColor = isValid ? "rgba(59,130,246,0.3)" : "rgba(239,68,68,0.3)";

        ctx.save();
        ctx.translate(wobbleX, 0);

        // Glow halo
        ctx.shadowColor = borderColor;
        ctx.shadowBlur = 12;

        // Body gradient
        const bodyGrad = ctx.createLinearGradient(ax, ay, ax, ay + a.height);
        bodyGrad.addColorStop(0, isValid ? "#0f1e3a" : "#200a0a");
        bodyGrad.addColorStop(0.5, isValid ? "#111d2e" : "#1a0c0c");
        bodyGrad.addColorStop(1, isValid ? "#090f1e" : "#130808");
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.roundRect(ax, ay, a.width, a.height, r);
        ctx.fill();

        // Border
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Inner glow line at top
        ctx.fillStyle = glowColor;
        ctx.beginPath();
        ctx.roundRect(ax + 2, ay + 2, a.width - 4, 3, [3, 3, 0, 0]);
        ctx.fill();

        // Label — word-wrap across up to 2 lines
        ctx.font = "bold 12px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = isValid ? "#93c5fd" : "#fca5a5";
        const maxW = a.width - 16;
        const words = a.label.split(" ");
        const lines: string[] = [];
        let current = "";
        for (const word of words) {
          const test = current ? current + " " + word : word;
          if (ctx.measureText(test).width <= maxW) {
            current = test;
          } else {
            if (current) lines.push(current);
            current = word;
          }
        }
        if (current) lines.push(current);
        const lineH = 15;
        const startY = a.y - ((lines.length - 1) * lineH) / 2;
        for (let li = 0; li < lines.length; li++) {
          ctx.fillText(lines[li], a.x, startY + li * lineH);
        }

        ctx.restore();
      }
    }

    function drawExplosions() {
      if (!ctx) return;
      for (const ex of explosionsRef.current) {
        const alpha = Math.min(1, ex.timer / 25);
        ctx.save();
        ctx.globalAlpha = alpha;
        // Particles
        for (const p of ex.particles) {
          const px = ex.x + p.vx * (90 - ex.timer) * 0.5;
          const py = ex.y + p.vy * (90 - ex.timer) * 0.5;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 6;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(px, py, p.r * alpha, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
        // Text
        ctx.font = "bold 15px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = ex.correct ? "#1DB97C" : "#EF4444";
        ctx.shadowColor = ex.correct ? "#1DB97C" : "#EF4444";
        ctx.shadowBlur = 10;
        ctx.fillText(ex.correct ? "✓ Correct!" : "✗ Wrong!", ex.x, ex.y - 22);
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }

    let lastTime = 0;
    function loop(time: number) {
      if (!ctx) return;
      if (lastTime === 0) lastTime = time;
      update(time);

      // Screen shake
      const shake = Math.max(0, shakeRef.current);
      const dx = shake > 0 ? (Math.random() - 0.5) * shake * 3 : 0;
      const dy = shake > 0 ? (Math.random() - 0.5) * shake * 3 : 0;
      ctx.save();
      ctx.translate(dx, dy);

      drawBg();
      if (gameStateRef.current === "playing" || gameStateRef.current === "over") {
        drawShip();
        drawBullets();
        drawAsteroids();
        drawExplosions();
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(loop);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    canvas.addEventListener("click", handleClick);
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      canvas.removeEventListener("click", handleClick);
      cancelAnimationFrame(rafRef.current);
    };
  }, [startGame, endGame, spawnAsteroid]);

  return (
    <div className="relative w-full max-w-[720px] mx-auto select-none" style={{ aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-full rounded-2xl"
        style={{ background: "#04060f" }}
      />

      {/* HUD */}
      {gameState === "playing" && (
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-3 pointer-events-none">
          <div className="text-sm font-mono font-bold text-green drop-shadow-lg">{score}</div>
          <div className="text-[10px] font-mono text-foreground/40 uppercase tracking-widest">Wave {wave}</div>
          <div className="flex gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-all ${i < lives ? "bg-red shadow-[0_0_6px_#EF4444]" : "bg-white/10"}`} />
            ))}
          </div>
        </div>
      )}

      {/* Start Screen */}
      {gameState === "start" && (() => {
        const bestScore = Math.max(0, ...getSessions().filter(s => s.gameId === "asteroids" && s.mentorId === config.id && s.score !== undefined).map(s => s.score!));
        return (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl gap-4" style={{ background: "rgba(4,6,15,0.88)" }}>
            <div className="w-16 h-16 rounded-2xl bg-green/10 border border-green/30 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-8 h-8 fill-green" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L4 20h3.5l1.5-3h6l1.5 3H20L12 2zm-1.5 12l1.5-5 1.5 5h-3z"/>
              </svg>
            </div>
            <h2 className="text-2xl font-black text-foreground tracking-tight">Asteroids</h2>
            <div className="text-foreground/55 text-sm text-center px-8 leading-relaxed max-w-xs space-y-1">
              <p>Shoot <span className="text-red font-semibold">red (invalid)</span> concepts to score <span className="text-green font-semibold">+10 pts</span>.</p>
              <p>Let <span className="text-blue font-semibold">blue (valid)</span> ones pass — shooting them costs <span className="text-red font-semibold">-10 pts</span>.</p>
              <p>Missing an invalid concept costs a life.</p>
            </div>
            <p className="text-foreground/25 text-xs text-center">A/D · Arrow keys · Hold Space to shoot</p>
            {/* Difficulty selector */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-[10px] font-mono text-muted uppercase tracking-widest">Difficulty</p>
              <div className="flex gap-2">
                {(["easy", "normal", "hard"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => { saveSettings({ asteroids: { difficulty: d } }); settingsRef.current = getSettings(); setAsteroidDifficulty(d); }}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      asteroidDifficulty === d
                        ? d === "easy" ? "bg-green text-white border-green" : d === "normal" ? "bg-amber text-white border-amber" : "bg-red text-white border-red"
                        : "bg-card border-card-border text-muted hover:border-white/20 hover:text-foreground"
                    }`}
                  >
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {bestScore > 0 && <p className="text-xs font-mono text-muted">Best: <span className="text-green font-bold">{bestScore}</span></p>}
            <button onClick={startGame} className="mt-1 px-8 py-2.5 bg-green text-white font-bold rounded-xl hover:opacity-90 transition-opacity text-sm uppercase tracking-wide cursor-pointer">
              Start
            </button>
          </div>
        );
      })()}

      {/* Game Over */}
      {gameState === "over" && (() => {
        const bestScore = Math.max(0, ...getSessions().filter(s => s.gameId === "asteroids" && s.mentorId === config.id && s.score !== undefined).map(s => s.score!));
        return (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl gap-3" style={{ background: "rgba(4,6,15,0.9)" }}>
            <h2 className="text-2xl font-black text-red tracking-tight">Game Over</h2>
            <div className="bg-card border border-card-border rounded-2xl px-10 py-5 text-center">
              <div className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">Score</div>
              <div className="text-4xl font-black font-mono text-green">{score}</div>
              <div className="text-[10px] font-mono text-muted mt-2">Wave {wave}</div>
              {bestScore > 0 && <div className="text-[10px] font-mono text-muted mt-1">Best: <span className="text-green font-semibold">{bestScore}</span></div>}
            </div>
            <button onClick={startGame} className="px-8 py-2.5 bg-green text-white font-bold rounded-xl hover:opacity-90 transition-opacity text-sm uppercase tracking-wide cursor-pointer">
              Play Again
            </button>
          </div>
        );
      })()}
    </div>
  );
}
