"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { MentorConfig } from "@/lib/types";
import { recordSession } from "@/lib/stats";

interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  concept: MentorConfig["concepts"][number];
  isPowerUp: boolean;
  broken: boolean;
  breakAnim: number;
  shakeX: number; // wobble on break
}

interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  squish: number; // 1 = normal, < 1 = squished on bounce
  facing: number; // -1 left, 1 right
  jumpTrail: Array<{ x: number; y: number; life: number }>;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; radius: number;
  shape: "circle" | "square";
}

interface Star {
  x: number; y: number; r: number; a: number; twinkleOffset: number; layer: number;
}

interface Cloud {
  x: number; y: number; w: number; h: number; speed: number;
}

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const GRAVITY = 0.4;
const JUMP_VELOCITY = -10;
const POWER_JUMP_VELOCITY = -18;
const MOVE_SPEED = 5;
const PLATFORM_WIDTH = 82;
const PLATFORM_HEIGHT = 14;
const PLAYER_W = 30;
const PLAYER_H = 30;
const INITIAL_PLATFORM_COUNT = 10;
const PLATFORM_SPACING_BASE = 55;
const PLATFORM_SPACING_GROWTH = 0.003;

function pickConcept(concepts: MentorConfig["concepts"]) {
  return concepts[Math.floor(Math.random() * concepts.length)];
}

function generatePlatforms(
  concepts: MentorConfig["concepts"],
  startY: number,
  count: number,
  heightOffset: number
): Platform[] {
  const platforms: Platform[] = [];
  const validConcepts = concepts.filter((c) => c.isValid);
  let consecutiveInvalid = 0;
  for (let i = 0; i < count; i++) {
    const spacing = PLATFORM_SPACING_BASE + heightOffset * PLATFORM_SPACING_GROWTH;
    const y = startY - i * spacing;
    const x = Math.random() * (CANVAS_WIDTH - PLATFORM_WIDTH);
    let concept = pickConcept(concepts);
    if (!concept.isValid && consecutiveInvalid >= 1 && validConcepts.length > 0) {
      concept = validConcepts[Math.floor(Math.random() * validConcepts.length)];
    }
    consecutiveInvalid = concept.isValid ? 0 : consecutiveInvalid + 1;
    platforms.push({
      x, y,
      width: PLATFORM_WIDTH,
      height: PLATFORM_HEIGHT,
      concept,
      isPowerUp: Math.random() < 0.08,
      broken: false,
      breakAnim: 0,
      shakeX: 0,
    });
  }
  return platforms;
}

function rr(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawModernPlatform(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  type: "valid" | "invalid" | "powerup",
  breakProgress: number, // 0 = intact, 1 = fully broken
  t: number // time for powerup animation
) {
  ctx.save();
  const r = h / 2;

  if (type === "invalid" && breakProgress > 0) {
    // Shake and crack effect
    ctx.globalAlpha = 1 - breakProgress * 0.8;
    const shakeAmt = (1 - breakProgress) * 4;
    ctx.translate(
      Math.sin(breakProgress * 30) * shakeAmt,
      breakProgress * 8
    );

    // Cracked red platform
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, `rgba(239,68,68,${0.9 - breakProgress * 0.5})`);
    grad.addColorStop(1, `rgba(185,28,28,${0.7 - breakProgress * 0.5})`);
    ctx.fillStyle = grad;
    rr(ctx, x, y, w, h, r);
    ctx.fill();
    // Crack lines
    ctx.strokeStyle = `rgba(255,200,200,${0.6 - breakProgress * 0.4})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.35, y + 1); ctx.lineTo(x + w * 0.45, y + h - 1);
    ctx.moveTo(x + w * 0.6, y + 2); ctx.lineTo(x + w * 0.5, y + h - 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (type === "powerup") {
    // Glowing cyan spring platform
    const pulse = 0.7 + Math.sin(t * 0.06) * 0.3;
    ctx.shadowColor = "rgba(59,130,246,0.8)";
    ctx.shadowBlur = 16 * pulse;
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, "#60a5fa");
    grad.addColorStop(0.5, "#3B82F6");
    grad.addColorStop(1, "#1d4ed8");
    ctx.fillStyle = grad;
    rr(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Shine
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    rr(ctx, x + 6, y + 2, w - 12, h * 0.45, r * 0.7);
    ctx.fill();
    // Spring coils
    ctx.strokeStyle = "rgba(147,197,253,0.9)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    const springX = x + w / 2;
    const springY = y - 6 - Math.abs(Math.sin(t * 0.06)) * 4;
    ctx.beginPath();
    ctx.moveTo(springX - 6, y);
    ctx.lineTo(springX - 3, springY + 6);
    ctx.lineTo(springX + 3, springY + 2);
    ctx.lineTo(springX + 6, y);
    ctx.stroke();
    // "BOOST" label
    ctx.fillStyle = "rgba(219,234,254,0.95)";
    ctx.font = "bold 7px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("BOOST", x + w / 2, y - 10);
    ctx.restore();
    return;
  }

  if (type === "valid") {
    // Lush green platform
    ctx.shadowColor = "rgba(29,185,124,0.5)";
    ctx.shadowBlur = 10;
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, "#34d399");
    grad.addColorStop(0.5, "#1DB97C");
    grad.addColorStop(1, "#065f46");
    ctx.fillStyle = grad;
    rr(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Shine strip
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    rr(ctx, x + 5, y + 2, w - 10, h * 0.42, r * 0.6);
    ctx.fill();
    // Edge highlight
    ctx.strokeStyle = "rgba(110,231,183,0.5)";
    ctx.lineWidth = 1;
    rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Invalid (not yet broken)
  ctx.shadowColor = "rgba(239,68,68,0.4)";
  ctx.shadowBlur = 8;
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, "#f87171");
  grad.addColorStop(0.5, "#EF4444");
  grad.addColorStop(1, "#7f1d1d");
  ctx.fillStyle = grad;
  rr(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Shine
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  rr(ctx, x + 5, y + 2, w - 10, h * 0.42, r * 0.6);
  ctx.fill();
  // Crack hint
  ctx.strokeStyle = "rgba(255,200,200,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y + 1); ctx.lineTo(x + w * 0.45, y + h - 1);
  ctx.stroke();
  ctx.restore();
}

export default function DoodleJumpGame({ config }: { config: MentorConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<"start" | "playing" | "over">("start");
  const [finalScore, setFinalScore] = useState(0);
  const keysRef = useRef<Set<string>>(new Set());
  const particlesRef = useRef<Particle[]>([]);
  const sessionStartRef = useRef(0);
  const tickRef = useRef(0);

  const gameRef = useRef<{
    player: Player;
    platforms: Platform[];
    cameraY: number;
    score: number;
    animFrameId: number;
    screenShake: number;
  } | null>(null);

  const starsRef = useRef<Star[]>(
    Array.from({ length: 80 }, (_, i) => ({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT * 3,
      r: Math.random() * 1.5 + 0.3,
      a: Math.random() * 0.6 + 0.2,
      twinkleOffset: Math.random() * Math.PI * 2,
      layer: i < 30 ? 0 : i < 60 ? 1 : 2,
    }))
  );

  const cloudsRef = useRef<Cloud[]>(
    Array.from({ length: 5 }, () => ({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      w: 60 + Math.random() * 80,
      h: 20 + Math.random() * 20,
      speed: 0.1 + Math.random() * 0.15,
    }))
  );

  function spawnParticles(x: number, y: number, color: string, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 1.5 + Math.random() * 3;
      particlesRef.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        life: 1,
        maxLife: 1,
        color,
        radius: 2.5 + Math.random() * 2.5,
        shape: Math.random() > 0.5 ? "square" : "circle",
      });
    }
  }

  const startGame = useCallback(() => {
    particlesRef.current = [];
    sessionStartRef.current = performance.now();
    tickRef.current = 0;
    const basePlatform: Platform = {
      x: CANVAS_WIDTH / 2 - PLATFORM_WIDTH / 2,
      y: CANVAS_HEIGHT - 50,
      width: PLATFORM_WIDTH,
      height: PLATFORM_HEIGHT,
      concept: { label: "START", isValid: true },
      isPowerUp: false,
      broken: false,
      breakAnim: 0,
      shakeX: 0,
    };
    gameRef.current = {
      player: {
        x: CANVAS_WIDTH / 2 - PLAYER_W / 2,
        y: CANVAS_HEIGHT - 50 - PLAYER_H,
        width: PLAYER_W,
        height: PLAYER_H,
        vx: 0,
        vy: 0,
        squish: 1,
        facing: 1,
        jumpTrail: [],
      },
      platforms: [
        basePlatform,
        ...generatePlatforms(config.concepts, CANVAS_HEIGHT - 110, INITIAL_PLATFORM_COUNT, 0),
      ],
      cameraY: 0,
      score: 0,
      animFrameId: 0,
      screenShake: 0,
    };
    setGameState("playing");
  }, [config.concepts]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (["ArrowLeft", "ArrowRight", "a", "d", "A", "D"].includes(e.key)) {
        e.preventDefault();
        keysRef.current.add(e.key);
      }
    }
    function onKeyUp(e: KeyboardEvent) { keysRef.current.delete(e.key); }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Start screen
  useEffect(() => {
    if (gameState !== "start") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Sky gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    bgGrad.addColorStop(0, "#050510");
    bgGrad.addColorStop(0.5, "#0a0a1a");
    bgGrad.addColorStop(1, "#0f0f20");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Ambient glow
    const glowGrad = ctx.createRadialGradient(CANVAS_WIDTH * 0.5, CANVAS_HEIGHT, 10, CANVAS_WIDTH * 0.5, CANVAS_HEIGHT, CANVAS_HEIGHT * 0.8);
    glowGrad.addColorStop(0, "rgba(29,185,124,0.06)");
    glowGrad.addColorStop(1, "transparent");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Stars
    for (const s of starsRef.current) {
      ctx.globalAlpha = s.a * (0.7 + Math.sin(s.twinkleOffset) * 0.3);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(s.x, s.y % CANVAS_HEIGHT, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Title card
    ctx.fillStyle = "rgba(17,17,30,0.85)";
    rr(ctx, 40, 90, CANVAS_WIDTH - 80, 110, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(29,185,124,0.4)";
    ctx.lineWidth = 1;
    rr(ctx, 40, 90, CANVAS_WIDTH - 80, 110, 16);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("DOODLE JUMP", CANVAS_WIDTH / 2, 138);

    ctx.fillStyle = "#1DB97C";
    ctx.font = "bold 9px monospace";
    ctx.letterSpacing = "0.2em";
    ctx.fillText("TRADING EDITION", CANVAS_WIDTH / 2, 160);
    ctx.letterSpacing = "0";

    // Sample platform icons
    const platY = 220;
    // Valid green
    ctx.save();
    drawModernPlatform(ctx, 30, platY, 80, PLATFORM_HEIGHT, "valid", 0, 0);
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Safe bounce", 120, platY + 10);

    // Invalid red
    ctx.save();
    drawModernPlatform(ctx, 30, platY + 40, 80, PLATFORM_HEIGHT, "invalid", 0, 0);
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText("Breaks on land!", 120, platY + 50);

    // Powerup blue
    ctx.save();
    drawModernPlatform(ctx, 30, platY + 80, 80, PLATFORM_HEIGHT, "powerup", 0, 0);
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText("Rocket boost!", 120, platY + 90);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("← → or A / D to move", CANVAS_WIDTH / 2, 370);

    // Start button
    const btnX = CANVAS_WIDTH / 2 - 90;
    const btnY = 400;
    const grad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + 44);
    grad.addColorStop(0, "#22c55e");
    grad.addColorStop(1, "#1DB97C");
    ctx.fillStyle = grad;
    ctx.shadowColor = "rgba(29,185,124,0.5)";
    ctx.shadowBlur = 18;
    rr(ctx, btnX, btnY, 180, 44, 22);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Shine
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    rr(ctx, btnX + 6, btnY + 4, 168, 20, 16);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText("TAP TO START", CANVAS_WIDTH / 2, btnY + 26);
  }, [gameState]);

  // Game over screen
  useEffect(() => {
    if (gameState !== "over") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "rgba(5,5,16,0.9)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Panel
    const panelX = 60, panelY = 160, panelW = CANVAS_WIDTH - 120, panelH = 220;
    const panelGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
    panelGrad.addColorStop(0, "rgba(20,10,10,0.95)");
    panelGrad.addColorStop(1, "rgba(10,10,10,0.95)");
    ctx.fillStyle = panelGrad;
    ctx.shadowColor = "rgba(239,68,68,0.3)";
    ctx.shadowBlur = 30;
    rr(ctx, panelX, panelY, panelW, panelH, 20);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(239,68,68,0.35)";
    ctx.lineWidth = 1;
    rr(ctx, panelX, panelY, panelW, panelH, 20);
    ctx.stroke();

    ctx.fillStyle = "#EF4444";
    ctx.font = "bold 30px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", CANVAS_WIDTH / 2, panelY + 48);

    ctx.fillStyle = "#888888";
    ctx.font = "9px monospace";
    ctx.letterSpacing = "0.15em";
    ctx.fillText("FINAL SCORE", CANVAS_WIDTH / 2, panelY + 80);
    ctx.letterSpacing = "0";

    ctx.fillStyle = "#1DB97C";
    ctx.font = "bold 52px monospace";
    ctx.fillText(String(finalScore), CANVAS_WIDTH / 2, panelY + 145);

    ctx.fillStyle = "#555";
    ctx.font = "10px sans-serif";
    ctx.fillText("meters climbed", CANVAS_WIDTH / 2, panelY + 168);

    // Replay button
    const btnX = CANVAS_WIDTH / 2 - 80;
    const btnY = 430;
    const grad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + 40);
    grad.addColorStop(0, "#22c55e");
    grad.addColorStop(1, "#1DB97C");
    ctx.fillStyle = grad;
    ctx.shadowColor = "rgba(29,185,124,0.4)";
    ctx.shadowBlur = 14;
    rr(ctx, btnX, btnY, 160, 40, 20);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    rr(ctx, btnX + 5, btnY + 4, 150, 18, 14);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("PLAY AGAIN", CANVAS_WIDTH / 2, btnY + 24);
  }, [gameState, finalScore]);

  // Click/key to start or restart
  useEffect(() => {
    function handleStart() {
      if (gameState === "start" || gameState === "over") startGame();
    }
    function handleKeyStart(e: KeyboardEvent) {
      if (gameState === "start") { startGame(); return; }
      if (gameState === "over" && !["ArrowLeft", "ArrowRight", "a", "d", "A", "D"].includes(e.key)) {
        startGame();
      }
    }
    const canvas = canvasRef.current;
    canvas?.addEventListener("click", handleStart);
    window.addEventListener("keydown", handleKeyStart);
    return () => {
      canvas?.removeEventListener("click", handleStart);
      window.removeEventListener("keydown", handleKeyStart);
    };
  }, [gameState, startGame]);

  // Main game loop
  useEffect(() => {
    if (gameState !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const game = gameRef.current;
    if (!game) return;

    let running = true;

    function loop() {
      if (!running || !game) return;
      tickRef.current++;
      const t = tickRef.current;
      const { player, platforms } = game;

      // Input
      const keys = keysRef.current;
      if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) {
        player.vx = -MOVE_SPEED;
        player.facing = -1;
      } else if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) {
        player.vx = MOVE_SPEED;
        player.facing = 1;
      } else {
        player.vx = 0;
      }

      // Physics
      player.vy += GRAVITY;
      player.x += player.vx;
      player.y += player.vy;

      // Squish recovery
      if (player.squish < 1) player.squish = Math.min(1, player.squish + 0.08);

      // Screen wrap
      if (player.x + player.width < 0) player.x = CANVAS_WIDTH;
      else if (player.x > CANVAS_WIDTH) player.x = -player.width;

      // Jump trail
      if (player.vy < -2) {
        player.jumpTrail.push({ x: player.x + player.width / 2, y: player.y + player.height / 2, life: 1 });
        if (player.jumpTrail.length > 12) player.jumpTrail.shift();
      } else {
        player.jumpTrail = [];
      }

      // Platform collision
      if (player.vy > 0) {
        for (const plat of platforms) {
          if (plat.broken) continue;
          const screenPlatY = plat.y - game.cameraY;
          if (
            player.x + player.width > plat.x + 4 &&
            player.x < plat.x + plat.width - 4 &&
            player.y + player.height >= screenPlatY &&
            player.y + player.height <= screenPlatY + plat.height + player.vy + 2
          ) {
            if (!plat.concept.isValid && !plat.isPowerUp) {
              plat.broken = true;
              plat.breakAnim = 0;
              game.screenShake = 6;
              spawnParticles(plat.x + plat.width / 2, screenPlatY, "#EF4444", 10);
              spawnParticles(plat.x + plat.width / 2, screenPlatY, "#fca5a5", 6);
              // still bounce but weakly
              player.vy = JUMP_VELOCITY * 0.5;
              player.squish = 0.65;
            } else if (plat.isPowerUp) {
              player.vy = POWER_JUMP_VELOCITY;
              player.y = screenPlatY - player.height;
              player.squish = 0.5;
              spawnParticles(plat.x + plat.width / 2, screenPlatY, "#60a5fa", 12);
              spawnParticles(plat.x + plat.width / 2, screenPlatY, "#bfdbfe", 8);
            } else {
              player.vy = JUMP_VELOCITY;
              player.y = screenPlatY - player.height;
              player.squish = 0.7;
              spawnParticles(plat.x + plat.width / 2, screenPlatY, "#34d399", 5);
            }
          }
        }
      }

      // Animate breaking platforms
      for (const plat of platforms) {
        if (plat.broken) plat.breakAnim = Math.min(1, plat.breakAnim + 0.06);
      }

      // Camera scroll
      const screenMid = CANVAS_HEIGHT / 3;
      if (player.y < screenMid) {
        const diff = screenMid - player.y;
        game.cameraY -= diff;
        player.y = screenMid;
        game.score = Math.max(game.score, Math.floor(Math.abs(game.cameraY) / 10));
      }

      // Generate new platforms
      const topEdge = game.cameraY;
      const highestPlatY = Math.min(...platforms.map((p) => p.y));
      if (highestPlatY > topEdge - CANVAS_HEIGHT) {
        platforms.push(
          ...generatePlatforms(
            config.concepts,
            highestPlatY - PLATFORM_SPACING_BASE,
            5,
            Math.abs(game.cameraY)
          )
        );
      }

      // Remove off-screen platforms
      const bottomEdge = game.cameraY + CANVAS_HEIGHT + 200;
      for (let i = platforms.length - 1; i >= 0; i--) {
        if (platforms[i].y > bottomEdge) platforms.splice(i, 1);
      }

      // Move clouds
      for (const cloud of cloudsRef.current) {
        cloud.x -= cloud.speed;
        if (cloud.x + cloud.w < 0) {
          cloud.x = CANVAS_WIDTH + 10;
          cloud.y = Math.random() * CANVAS_HEIGHT;
        }
      }

      // Update particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.12;
        p.vx *= 0.95;
        p.life -= 0.04;
        if (p.life <= 0) particlesRef.current.splice(i, 1);
      }

      // Screen shake decay
      if (game.screenShake > 0) game.screenShake = Math.max(0, game.screenShake - 0.8);

      // Game over
      if (player.y > CANVAS_HEIGHT + 50) {
        running = false;
        setFinalScore(game.score);
        recordSession({
          gameId: "doodle-jump",
          gameName: "Doodle Jump",
          mentorId: config.id,
          timestamp: Date.now(),
          durationMs: performance.now() - sessionStartRef.current,
          score: game.score,
        });
        setGameState("over");
        return;
      }

      // ── DRAW ──
      ctx!.save();
      if (game.screenShake > 0) {
        ctx!.translate(
          (Math.random() - 0.5) * game.screenShake,
          (Math.random() - 0.5) * game.screenShake
        );
      }

      // Background gradient sky
      const bgGrad = ctx!.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      bgGrad.addColorStop(0, "#050510");
      bgGrad.addColorStop(0.6, "#080818");
      bgGrad.addColorStop(1, "#0d0d1a");
      ctx!.fillStyle = bgGrad;
      ctx!.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Ambient green glow from bottom
      const ambGrad = ctx!.createRadialGradient(CANVAS_WIDTH / 2, CANVAS_HEIGHT + 80, 20, CANVAS_WIDTH / 2, CANVAS_HEIGHT + 80, CANVAS_HEIGHT * 0.7);
      ambGrad.addColorStop(0, "rgba(29,185,124,0.07)");
      ambGrad.addColorStop(1, "transparent");
      ctx!.fillStyle = ambGrad;
      ctx!.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Stars with parallax and twinkling
      for (const s of starsRef.current) {
        const parallax = s.layer === 0 ? 0.05 : s.layer === 1 ? 0.12 : 0.2;
        const sy = ((s.y - game.cameraY * parallax) % (CANVAS_HEIGHT * 3) + CANVAS_HEIGHT * 3) % (CANVAS_HEIGHT * 3);
        if (sy > CANVAS_HEIGHT) continue;
        const twinkle = 0.5 + Math.sin(t * 0.04 + s.twinkleOffset) * 0.5;
        ctx!.globalAlpha = s.a * twinkle;
        ctx!.fillStyle = "#ffffff";
        ctx!.beginPath();
        ctx!.arc(s.x, sy, s.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;

      // Parallax clouds
      for (const cloud of cloudsRef.current) {
        ctx!.globalAlpha = 0.05;
        ctx!.fillStyle = "#aaaacc";
        const cloudY = cloud.y + Math.sin(t * 0.005 + cloud.x * 0.01) * 3;
        // Fluffy cloud shape
        ctx!.beginPath();
        ctx!.arc(cloud.x + cloud.w * 0.3, cloudY + cloud.h * 0.5, cloud.h * 0.5, 0, Math.PI * 2);
        ctx!.arc(cloud.x + cloud.w * 0.55, cloudY + cloud.h * 0.35, cloud.h * 0.62, 0, Math.PI * 2);
        ctx!.arc(cloud.x + cloud.w * 0.75, cloudY + cloud.h * 0.5, cloud.h * 0.45, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;

      // Subtle grid (matches global theme)
      ctx!.strokeStyle = "rgba(255,255,255,0.02)";
      ctx!.lineWidth = 1;
      const gridOffset = game.cameraY % 32;
      for (let x = 0; x < CANVAS_WIDTH; x += 32) {
        ctx!.beginPath(); ctx!.moveTo(x, 0); ctx!.lineTo(x, CANVAS_HEIGHT); ctx!.stroke();
      }
      for (let y = -gridOffset; y < CANVAS_HEIGHT; y += 32) {
        ctx!.beginPath(); ctx!.moveTo(0, y); ctx!.lineTo(CANVAS_WIDTH, y); ctx!.stroke();
      }

      // Platforms
      for (const plat of platforms) {
        const screenY = plat.y - game.cameraY;
        if (screenY < -40 || screenY > CANVAS_HEIGHT + 40) continue;

        const type = plat.isPowerUp ? "powerup" : plat.concept.isValid ? "valid" : "invalid";

        ctx!.save();
        drawModernPlatform(ctx!, plat.x, screenY, plat.width, plat.height, type, plat.breakAnim, t);
        ctx!.restore();

        // Label above platform (small, readable)
        if (!plat.broken) {
          const labelText = plat.isPowerUp
            ? ""
            : plat.concept.label.length > 12
            ? plat.concept.label.slice(0, 11) + "…"
            : plat.concept.label;
          if (labelText) {
            const labelColor = plat.concept.isValid ? "rgba(110,231,183,0.9)" : "rgba(252,165,165,0.9)";
            ctx!.fillStyle = labelColor;
            ctx!.font = "bold 8px sans-serif";
            ctx!.textAlign = "center";
            ctx!.fillText(labelText, plat.x + plat.width / 2, screenY - 4);
          }
        }
      }

      // Particles
      for (const p of particlesRef.current) {
        ctx!.globalAlpha = p.life * p.life;
        ctx!.fillStyle = p.color;
        ctx!.shadowColor = p.color;
        ctx!.shadowBlur = 5;
        if (p.shape === "square") {
          const s = p.radius * p.life * 2;
          ctx!.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        } else {
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
          ctx!.fill();
        }
      }
      ctx!.globalAlpha = 1;
      ctx!.shadowBlur = 0;

      // Jump trail
      for (let i = 0; i < player.jumpTrail.length; i++) {
        const tr = player.jumpTrail[i];
        const prog = i / player.jumpTrail.length;
        ctx!.globalAlpha = tr.life * prog * 0.4;
        ctx!.fillStyle = "#1DB97C";
        ctx!.beginPath();
        ctx!.arc(tr.x, tr.y, 3 * prog, 0, Math.PI * 2);
        ctx!.fill();
        tr.life -= 0.1;
      }
      ctx!.globalAlpha = 1;

      // ── Player Character ──
      const px = player.x + player.width / 2;
      const py = player.y + player.height / 2;
      const squishX = player.squish < 1 ? (2 - player.squish) : 1;
      const squishY = player.squish;
      const pr = (player.width / 2) * 0.95;

      ctx!.save();
      ctx!.translate(px, py);
      ctx!.scale(squishX, squishY);

      // Shadow below character
      ctx!.save();
      ctx!.scale(1, 0.3);
      ctx!.globalAlpha = 0.25;
      ctx!.fillStyle = "#000000";
      ctx!.beginPath();
      ctx!.arc(0, pr * 3.5, pr * 0.9, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.restore();

      // Outer glow
      ctx!.shadowColor = "#F59E0B";
      ctx!.shadowBlur = 18;

      // Body gradient (warm gold character)
      const bodyGrad = ctx!.createRadialGradient(-pr * 0.3, -pr * 0.3, pr * 0.05, 0, 0, pr);
      bodyGrad.addColorStop(0, "#fde68a");
      bodyGrad.addColorStop(0.45, "#f59e0b");
      bodyGrad.addColorStop(1, "#b45309");
      ctx!.fillStyle = bodyGrad;
      ctx!.beginPath();
      ctx!.arc(0, 0, pr, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.shadowBlur = 0;

      // Shine
      ctx!.fillStyle = "rgba(255,255,255,0.3)";
      ctx!.beginPath();
      ctx!.arc(-pr * 0.28, -pr * 0.28, pr * 0.35, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle = "rgba(255,255,255,0.15)";
      ctx!.beginPath();
      ctx!.arc(-pr * 0.2, -pr * 0.2, pr * 0.22, 0, Math.PI * 2);
      ctx!.fill();

      // Eyes
      const eyeOffX = player.facing * 2;
      // Left eye
      ctx!.fillStyle = "#1a0a00";
      ctx!.beginPath(); ctx!.ellipse(eyeOffX - 5, -3, 3.5, 3.5, 0, 0, Math.PI * 2); ctx!.fill();
      // Right eye
      ctx!.beginPath(); ctx!.ellipse(eyeOffX + 5, -3, 3.5, 3.5, 0, 0, Math.PI * 2); ctx!.fill();
      // Eye shine
      ctx!.fillStyle = "#ffffff";
      ctx!.beginPath(); ctx!.arc(eyeOffX - 4, -4.5, 1.5, 0, Math.PI * 2); ctx!.fill();
      ctx!.beginPath(); ctx!.arc(eyeOffX + 6, -4.5, 1.5, 0, Math.PI * 2); ctx!.fill();

      // Smile
      ctx!.strokeStyle = "#7c3100";
      ctx!.lineWidth = 1.5;
      ctx!.lineCap = "round";
      ctx!.beginPath();
      ctx!.arc(eyeOffX, 2, 4.5, 0.15, Math.PI - 0.15);
      ctx!.stroke();

      // Tiny propeller on top (spinning when going up fast)
      if (player.vy < -4) {
        const spinAngle = t * 0.3;
        ctx!.strokeStyle = "rgba(253,224,71,0.9)";
        ctx!.lineWidth = 2;
        ctx!.lineCap = "round";
        for (let b = 0; b < 3; b++) {
          const angle = spinAngle + (b * Math.PI * 2) / 3;
          ctx!.beginPath();
          ctx!.moveTo(0, -pr);
          ctx!.lineTo(Math.cos(angle) * 8, -pr - Math.sin(angle) * 4);
          ctx!.stroke();
        }
      }

      ctx!.restore(); // player transform

      // Score HUD — top center
      ctx!.fillStyle = "rgba(10,10,20,0.7)";
      rr(ctx!, CANVAS_WIDTH / 2 - 45, 10, 90, 44, 10);
      ctx!.fill();
      ctx!.strokeStyle = "rgba(255,255,255,0.08)";
      ctx!.lineWidth = 1;
      rr(ctx!, CANVAS_WIDTH / 2 - 45, 10, 90, 44, 10);
      ctx!.stroke();

      ctx!.fillStyle = "#1DB97C";
      ctx!.font = "bold 20px monospace";
      ctx!.textAlign = "center";
      ctx!.fillText(String(game.score), CANVAS_WIDTH / 2, 36);
      ctx!.fillStyle = "#888888";
      ctx!.font = "7px monospace";
      ctx!.letterSpacing = "0.1em";
      ctx!.fillText("SCORE", CANVAS_WIDTH / 2, 48);
      ctx!.letterSpacing = "0";

      ctx!.restore(); // screen shake

      game.animFrameId = requestAnimationFrame(loop);
    }

    game.animFrameId = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(game.animFrameId);
    };
  }, [gameState, config.concepts]);

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="rounded-xl border border-card-border cursor-pointer"
      />
    </div>
  );
}
