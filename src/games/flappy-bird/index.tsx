"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { MentorConfig } from "@/lib/types";
import { recordSession, getSessions } from "@/lib/stats";
import { getSettings } from "@/lib/settings";

interface FlappyBirdProps {
  config: MentorConfig;
}

type GameState = "idle" | "playing" | "gameover";

interface Bird {
  x: number;
  y: number;
  velocity: number;
  radius: number;
  rotation: number;
}

interface Pipe {
  x: number;
  gapY: number;
  gapHeight: number;
  width: number;
  passed: boolean;
  ruleIndex: number;
  halfChecked: boolean;
}

interface Cloud {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  opacity: number;
}

const GRAVITY = 0.45;
const FLAP_STRENGTH = -5.6;
const PIPE_WIDTH = 72;
const PIPE_SPACING = 340;
const BIRD_RADIUS = 18;
const GROUND_HEIGHT = 48;
const SPEED_INCREMENT = 0.08;
const DIVIDER_HEIGHT = 18;

const DIFFICULTY_SETTINGS = {
  easy:   { baseSpeed: 1.5, gapHeight: 290 },
  normal: { baseSpeed: 2.0, gapHeight: 250 },
  hard:   { baseSpeed: 2.5, gapHeight: 210 },
} as const;

export default function FlappyBird({ config }: FlappyBirdProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const gameStateRef = useRef<GameState>("idle");
  const birdRef = useRef<Bird>({ x: 90, y: 300, velocity: 0, radius: BIRD_RADIUS, rotation: 0 });
  const pipesRef = useRef<Pipe[]>([]);
  const scoreRef = useRef(0);
  const frameRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const failedRuleRef = useRef<{ rule: string; description?: string; isTrue: boolean } | null>(null);
  const canvasSizeRef = useRef({ width: 480, height: 640 });
  const sessionStartRef = useRef(0);
  const settingsRef = useRef(getSettings());
  const cloudsRef = useRef<Cloud[]>([]);
  const shakeRef = useRef(0);
  const starsRef = useRef<{ x: number; y: number; r: number; a: number; twinkle: number }[]>([]);
  const cameraYRef = useRef(0);

  const [, setRenderTick] = useState(0);

  const rules = config.rules;

  // Init clouds + stars once
  useEffect(() => {
    const { width, height } = canvasSizeRef.current;
    cloudsRef.current = Array.from({ length: 6 }, (_, i) => ({
      x: (i / 6) * width * 1.5,
      y: 30 + Math.random() * (height * 0.45),
      width: 80 + Math.random() * 100,
      height: 30 + Math.random() * 40,
      speed: 0.2 + Math.random() * 0.3,
      opacity: 0.04 + Math.random() * 0.06,
    }));
    starsRef.current = Array.from({ length: 60 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height * 0.7,
      r: 0.5 + Math.random() * 1.5,
      a: 0.3 + Math.random() * 0.7,
      twinkle: Math.random() * Math.PI * 2,
    }));
  }, []);

  const getSpeed = useCallback(() => {
    const difficulty = settingsRef.current.flappy_bird.difficulty;
    const base = DIFFICULTY_SETTINGS[difficulty].baseSpeed;
    return base + scoreRef.current * SPEED_INCREMENT;
  }, []);

  const resetGame = useCallback(() => {
    const h = canvasSizeRef.current.height;
    birdRef.current = { x: 90, y: h / 2, velocity: 0, radius: BIRD_RADIUS, rotation: 0 };
    pipesRef.current = [];
    scoreRef.current = 0;
    frameRef.current = 0;
    failedRuleRef.current = null;
    shakeRef.current = 0;
    cameraYRef.current = 0;
  }, []);

  const spawnPipe = useCallback(() => {
    const { width, height } = canvasSizeRef.current;
    const difficulty = settingsRef.current.flappy_bird.difficulty;
    const GAP_HEIGHT = DIFFICULTY_SETTINGS[difficulty].gapHeight;
    const minGapY = GAP_HEIGHT / 2 + 80;
    const maxGapY = height - GAP_HEIGHT / 2 - GROUND_HEIGHT - 60;
    const screenGapY = minGapY + Math.random() * (maxGapY - minGapY);
    const gapY = screenGapY + cameraYRef.current; // store in world coords
    const ruleIndex = Math.floor(Math.random() * rules.length);
    const lastPipe = pipesRef.current[pipesRef.current.length - 1];
    const startX = lastPipe ? Math.max(lastPipe.x + PIPE_SPACING, width + 80) : width + 80;
    pipesRef.current.push({ x: startX, gapY, gapHeight: GAP_HEIGHT, width: PIPE_WIDTH, passed: false, ruleIndex, halfChecked: false });
  }, [rules.length]);

  const flap = useCallback(() => {
    if (gameStateRef.current === "idle") {
      gameStateRef.current = "playing";
      settingsRef.current = getSettings();
      sessionStartRef.current = performance.now();
      resetGame();
      birdRef.current.velocity = FLAP_STRENGTH;
      spawnPipe(); spawnPipe(); spawnPipe();
      setRenderTick((t) => t + 1);
      return;
    }
    if (gameStateRef.current === "playing") {
      birdRef.current.velocity = FLAP_STRENGTH;
    }
  }, [resetGame, spawnPipe]);

  const restart = useCallback(() => {
    resetGame();
    gameStateRef.current = "idle";
    setRenderTick((t) => t + 1);
  }, [resetGame]);

  // ─────────────── DRAW BACKGROUND ───────────────
  const drawBackground = useCallback((ctx: CanvasRenderingContext2D, time: number) => {
    const { width, height } = canvasSizeRef.current;

    // Sky gradient — deep midnight blue to near-black
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, "#060814");
    skyGrad.addColorStop(0.55, "#0b1a2e");
    skyGrad.addColorStop(1, "#0a0f18");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Nebula glow (green tint, subtle)
    const nebula = ctx.createRadialGradient(width * 0.7, height * 0.3, 0, width * 0.7, height * 0.3, width * 0.5);
    nebula.addColorStop(0, "rgba(29,185,124,0.05)");
    nebula.addColorStop(1, "transparent");
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, width, height);

    // Stars with twinkle — parallax offset vertically
    const camY = cameraYRef.current;
    for (const s of starsRef.current) {
      s.twinkle += 0.03;
      const twinkleFactor = 0.6 + 0.4 * Math.sin(s.twinkle);
      ctx.globalAlpha = s.a * twinkleFactor;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      // Parallax: stars move at 20% of camera speed
      const sy = ((s.y - camY * 0.2) % height + height) % height;
      ctx.arc(s.x, sy, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Scrolling clouds
    for (const cloud of cloudsRef.current) {
      if (gameStateRef.current === "playing") cloud.x -= cloud.speed;
      if (cloud.x + cloud.width < 0) cloud.x = width + cloud.width;
      ctx.save();
      ctx.globalAlpha = cloud.opacity;
      ctx.fillStyle = "#4a8fc4";
      ctx.beginPath();
      ctx.ellipse(cloud.x, cloud.y, cloud.width / 2, cloud.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = cloud.opacity * 0.6;
      ctx.beginPath();
      ctx.ellipse(cloud.x - cloud.width * 0.25, cloud.y + 5, cloud.width * 0.35, cloud.height * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Ground — layered
    const groundGrad = ctx.createLinearGradient(0, height - GROUND_HEIGHT, 0, height);
    groundGrad.addColorStop(0, "#0d2a14");
    groundGrad.addColorStop(0.3, "#112e18");
    groundGrad.addColorStop(1, "#0a1f10");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, height - GROUND_HEIGHT, width, GROUND_HEIGHT);

    // Ground highlight line
    ctx.strokeStyle = "rgba(29,185,124,0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, height - GROUND_HEIGHT);
    ctx.lineTo(width, height - GROUND_HEIGHT);
    ctx.stroke();

    // Grass tufts
    const grassOffset = ((time * 0.5) % 32);
    for (let gx = -grassOffset; gx < width + 32; gx += 32) {
      ctx.fillStyle = "rgba(29,185,124,0.25)";
      ctx.beginPath();
      ctx.moveTo(gx, height - GROUND_HEIGHT);
      ctx.quadraticCurveTo(gx + 5, height - GROUND_HEIGHT - 8, gx + 10, height - GROUND_HEIGHT);
      ctx.fill();
    }
  }, []);

  // ─────────────── DRAW BIRD ───────────────
  const drawBird = useCallback((ctx: CanvasRenderingContext2D, bird: Bird, bobOffset: number) => {
    const bx = bird.x;
    const by = bird.y + bobOffset;
    const r = bird.radius;
    const rot = Math.max(-0.6, Math.min(0.8, bird.velocity * 0.06));

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(rot);

    // Body shadow
    ctx.shadowColor = "rgba(240,165,0,0.4)";
    ctx.shadowBlur = 14;

    // Body gradient (orange → gold → amber)
    const bodyGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.05, 0, 0, r * 1.15);
    bodyGrad.addColorStop(0, "#ffe566");
    bodyGrad.addColorStop(0.45, "#f0a500");
    bodyGrad.addColorStop(1, "#c47800");
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.15, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // White belly
    const bellyGrad = ctx.createRadialGradient(r * 0.1, r * 0.3, 0, r * 0.1, r * 0.3, r * 0.6);
    bellyGrad.addColorStop(0, "rgba(255,255,255,0.4)");
    bellyGrad.addColorStop(1, "transparent");
    ctx.fillStyle = bellyGrad;
    ctx.beginPath();
    ctx.ellipse(r * 0.1, r * 0.3, r * 0.55, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wing (animates)
    const wingFlutter = Math.sin(Date.now() / 70) * 4;
    const wingGrad = ctx.createRadialGradient(-r * 0.3, r * 0.05 + wingFlutter, 0, -r * 0.3, r * 0.05, r * 0.65);
    wingGrad.addColorStop(0, "#d49200");
    wingGrad.addColorStop(1, "#a06800");
    ctx.fillStyle = wingGrad;
    ctx.beginPath();
    ctx.ellipse(-r * 0.28, r * 0.05 + wingFlutter, r * 0.58, r * 0.32, -0.25, 0, Math.PI * 2);
    ctx.fill();

    // Eye white
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(r * 0.42, -r * 0.22, r * 0.34, 0, Math.PI * 2);
    ctx.fill();

    // Pupil + highlight
    ctx.fillStyle = "#1a1a2e";
    ctx.beginPath();
    ctx.arc(r * 0.52, -r * 0.22, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(r * 0.58, -r * 0.29, r * 0.07, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = "#ff6b35";
    ctx.strokeStyle = "#cc4400";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(r * 0.88, -r * 0.08);
    ctx.lineTo(r * 1.62, r * 0.1);
    ctx.lineTo(r * 0.88, r * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Beak line (open/close)
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(r * 0.9, r * 0.12);
    ctx.lineTo(r * 1.55, r * 0.12);
    ctx.stroke();

    ctx.restore();
  }, []);

  // ─────────────── DRAW PIPE ───────────────
  const drawPipe = useCallback((ctx: CanvasRenderingContext2D, pipe: Pipe) => {
    const { height } = canvasSizeRef.current;
    const rule = rules[pipe.ruleIndex];
    const camY = cameraYRef.current;

    // Convert world coords to screen coords
    const topGapEdge = pipe.gapY - pipe.gapHeight / 2 - camY;
    const bottomGapEdge = pipe.gapY + pipe.gapHeight / 2 - camY;
    const dividerTop = pipe.gapY - DIVIDER_HEIGHT / 2 - camY;
    const dividerBottom = pipe.gapY + DIVIDER_HEIGHT / 2 - camY;
    const pw = pipe.width;
    const px = pipe.x;
    const groundTop = height - GROUND_HEIGHT; // screen-space, fixed

    // Helper: draw a single pipe segment
    const drawSegment = (segX: number, segY: number, segH: number, capAtBottom: boolean) => {
      if (segH <= 0) return;
      // Main pipe body gradient
      const pipeGrad = ctx.createLinearGradient(segX, 0, segX + pw, 0);
      pipeGrad.addColorStop(0, "#0c3d20");
      pipeGrad.addColorStop(0.2, "#1a6b3a");
      pipeGrad.addColorStop(0.5, "#1DB97C");
      pipeGrad.addColorStop(0.75, "#0f8050");
      pipeGrad.addColorStop(1, "#083d20");
      ctx.fillStyle = pipeGrad;
      ctx.fillRect(segX + 4, segY, pw - 8, segH);

      // Left/right edge highlights
      ctx.fillStyle = "rgba(29,185,124,0.15)";
      ctx.fillRect(segX + 4, segY, 4, segH);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(segX + pw - 8, segY, 4, segH);

      // Cap
      const capH = 22;
      const capY = capAtBottom ? segY + segH - capH : segY;
      const capGrad = ctx.createLinearGradient(segX, 0, segX + pw + 12, 0);
      capGrad.addColorStop(0, "#0c3d20");
      capGrad.addColorStop(0.15, "#1DB97C");
      capGrad.addColorStop(0.5, "#2dd98f");
      capGrad.addColorStop(0.85, "#1DB97C");
      capGrad.addColorStop(1, "#083d20");
      ctx.fillStyle = capGrad;
      ctx.beginPath();
      if (capAtBottom) {
        ctx.roundRect(segX - 5, capY, pw + 10, capH, [0, 0, 8, 8]);
      } else {
        ctx.roundRect(segX - 5, capY, pw + 10, capH, [8, 8, 0, 0]);
      }
      ctx.fill();

      // Cap shine line
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(segX - 4, capAtBottom ? capY + 4 : capY + capH - 4);
      ctx.lineTo(segX + pw + 4, capAtBottom ? capY + 4 : capY + capH - 4);
      ctx.stroke();
    };

    // Top pipe (0 → topGapEdge) — clipped to screen
    drawSegment(px, 0, topGapEdge, true);

    // Bottom pipe (bottomGapEdge → ground)
    drawSegment(px, bottomGapEdge, groundTop - bottomGapEdge, false);

    // ── Divider bar in the middle of the gap ──
    const dividerGrad = ctx.createLinearGradient(px, 0, px + pw, 0);
    dividerGrad.addColorStop(0, "#0c3d20");
    dividerGrad.addColorStop(0.2, "#1a6b3a");
    dividerGrad.addColorStop(0.5, "#1DB97C");
    dividerGrad.addColorStop(0.75, "#0f8050");
    dividerGrad.addColorStop(1, "#083d20");
    ctx.fillStyle = dividerGrad;
    ctx.beginPath();
    ctx.roundRect(px - 3, dividerTop, pw + 6, DIVIDER_HEIGHT, 4);
    ctx.fill();

    // Divider shine
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px - 2, dividerTop + 3);
    ctx.lineTo(px + pw + 2, dividerTop + 3);
    ctx.stroke();

    // ── TRUE label — center of top opening ──
    const trueOpeningCenterY = (topGapEdge + dividerTop) / 2;
    const labelX = px + pw / 2;
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (trueOpeningCenterY > 20 && trueOpeningCenterY < height) {
      const trueW = ctx.measureText("TRUE").width + 20;
      ctx.fillStyle = "rgba(29,185,124,0.22)";
      ctx.strokeStyle = "rgba(29,185,124,0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(labelX - trueW / 2, trueOpeningCenterY - 12, trueW, 24, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#1DB97C";
      ctx.fillText("TRUE", labelX, trueOpeningCenterY);
    }

    // ── FALSE label — center of bottom opening ──
    const falseOpeningCenterY = (dividerBottom + bottomGapEdge) / 2;

    if (falseOpeningCenterY > 20 && falseOpeningCenterY < groundTop) {
      const falseW = ctx.measureText("FALSE").width + 20;
      ctx.fillStyle = "rgba(239,68,68,0.22)";
      ctx.strokeStyle = "rgba(239,68,68,0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(labelX - falseW / 2, falseOpeningCenterY - 12, falseW, 24, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#EF4444";
      ctx.fillText("FALSE", labelX, falseOpeningCenterY);
    }

    // ── Question rule text above the pipe ──
    if (rule && px > -120 && px < canvasSizeRef.current.width + 60) {
      const qY = Math.max(28, topGapEdge - 50);
      const maxW = 220;
      ctx.font = "bold 12px system-ui, sans-serif";
      const textW = Math.min(ctx.measureText(rule.rule).width, maxW);
      const bgW = textW + 24;

      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(labelX - bgW / 2, qY - 14, bgW, 28, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#f0f0f0";
      ctx.fillText(rule.rule, labelX, qY, maxW);
    }
  }, [rules]);

  // ─────────────── MAIN GAME LOOP ───────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let time = 0;

    const loop = () => {
      time += 1;
      const { width, height } = canvasSizeRef.current;
      canvas.width = width;
      canvas.height = height;

      // Screen shake
      let shakeX = 0, shakeY = 0;
      if (shakeRef.current > 0) {
        const mag = shakeRef.current * 4;
        shakeX = (Math.random() - 0.5) * mag;
        shakeY = (Math.random() - 0.5) * mag;
        shakeRef.current -= 0.8;
        ctx.save();
        ctx.translate(shakeX, shakeY);
      }

      drawBackground(ctx, time);

      const state = gameStateRef.current;
      const bird = birdRef.current;
      const pipes = pipesRef.current;

      if (state === "idle") {
        const idleBob = Math.sin(Date.now() / 300) * 10;
        // Idle bird at start position
        bird.y = height / 2 + idleBob;
        drawBird(ctx, bird, 0);

        // Best score from sessions
        const sessions = getSessions();
        const bestScore = sessions
          .filter((s) => s.gameId === "flappy-bird")
          .reduce((best, s) => Math.max(best, s.score ?? 0), 0);

        const difficulty = settingsRef.current.flappy_bird.difficulty;
        const diffLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

        // Start screen text
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.shadowColor = "rgba(29,185,124,0.6)";
        ctx.shadowBlur = 20;
        ctx.font = "bold 30px system-ui, sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.fillText("Flappy Trader", width / 2, height / 3 - 10);
        ctx.shadowBlur = 0;

        ctx.font = "16px system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillText("Tap or Space to flap", width / 2, height / 3 + 28);

        ctx.font = "13px system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.28)";
        ctx.fillText("Navigate through TRUE or FALSE opening based on each rule", width / 2, height / 3 + 55, width - 40);
        ctx.fillText("Top opening = TRUE   ·   Bottom opening = FALSE", width / 2, height / 3 + 75, width - 40);

        // Speed label and best score
        ctx.font = "12px system-ui, sans-serif";
        ctx.fillStyle = "rgba(29,185,124,0.6)";
        ctx.fillText(`Speed: ${diffLabel}`, width / 2 - 50, height / 3 + 100);
        if (bestScore > 0) {
          ctx.fillStyle = "rgba(255,200,50,0.7)";
          ctx.fillText(`Best: ${bestScore}`, width / 2 + 50, height / 3 + 100);
        }

        // Bouncing arrow
        const arrowBob = Math.sin(Date.now() / 400) * 5;
        ctx.font = "20px system-ui, sans-serif";
        ctx.fillStyle = "rgba(29,185,124,0.7)";
        ctx.fillText("↓", width / 2, height / 3 + 125 + arrowBob);
      }

      if (state === "playing") {
        frameRef.current++;
        const speed = getSpeed();

        // Bird physics + rotation
        bird.velocity += GRAVITY;
        bird.y += bird.velocity;
        bird.rotation = Math.max(-0.6, Math.min(0.8, bird.velocity * 0.06));

        // Update camera — scroll up when bird approaches top 35% of viewport
        const birdScreenY = bird.y - cameraYRef.current;
        if (birdScreenY < height * 0.35) {
          cameraYRef.current = bird.y - height * 0.35;
        }

        // Move pipes
        for (const pipe of pipes) pipe.x -= speed;
        pipesRef.current = pipes.filter((p) => p.x + p.width > -60);

        const rightmostPipe = pipesRef.current[pipesRef.current.length - 1];
        if (!rightmostPipe || rightmostPipe.x < width + 100) spawnPipe();

        // Collision — use screen-space bird Y
        const birdSY = bird.y - cameraYRef.current;
        let crashed = false, wrongAnswer = false;

        // Ground death (screen space)
        if (birdSY + bird.radius > height - GROUND_HEIGHT) crashed = true;
        // No ceiling death — camera follows bird upward

        for (const pipe of pipesRef.current) {
          // Convert pipe world positions to screen coords
          const screenTopGapEdge = (pipe.gapY - pipe.gapHeight / 2) - cameraYRef.current;
          const screenBottomGapEdge = (pipe.gapY + pipe.gapHeight / 2) - cameraYRef.current;
          const dividerTop = pipe.gapY - DIVIDER_HEIGHT / 2 - cameraYRef.current;
          const dividerBottom = pipe.gapY + DIVIDER_HEIGHT / 2 - cameraYRef.current;

          if (bird.x + bird.radius > pipe.x + 4 && bird.x - bird.radius < pipe.x + pipe.width - 4) {
            // Top pipe collision (screen space)
            if (birdSY - bird.radius < screenTopGapEdge) crashed = true;
            // Bottom pipe collision (screen space)
            if (birdSY + bird.radius > screenBottomGapEdge) crashed = true;
            // Divider collision (screen space)
            if (birdSY + bird.radius > dividerTop && birdSY - bird.radius < dividerBottom) crashed = true;

            if (!crashed && !pipe.passed && !pipe.halfChecked && bird.x > pipe.x + pipe.width / 2) {
              pipe.halfChecked = true;
              const rule = rules[pipe.ruleIndex];
              // Player chose true if bird is above center of gap (screen space)
              const playerChoseTrue = birdSY < (pipe.gapY - cameraYRef.current);
              if (playerChoseTrue !== rule.isTrue) {
                wrongAnswer = true;
                failedRuleRef.current = rule;
                crashed = true;
              }
            }
          }
          if (!pipe.passed && pipe.x + pipe.width < bird.x - bird.radius) {
            pipe.passed = true;
            scoreRef.current++;
          }
        }

        if (crashed) {
          shakeRef.current = 8;
          gameStateRef.current = "gameover";
          recordSession({ gameId: "flappy-bird", gameName: "Flappy Bird", mentorId: config.id, timestamp: Date.now(), durationMs: performance.now() - sessionStartRef.current, score: scoreRef.current });
          if (!wrongAnswer) {
            const nearest = pipesRef.current.reduce<Pipe | null>((c, p) => !c || Math.abs(p.x - bird.x) < Math.abs(c.x - bird.x) ? p : c, null);
            if (nearest) failedRuleRef.current = rules[nearest.ruleIndex];
          }
          setRenderTick((t) => t + 1);
        }

        for (const pipe of pipesRef.current) drawPipe(ctx, pipe);
        // Draw bird at screen position
        const birdForDraw = { ...bird, y: bird.y - cameraYRef.current };
        drawBird(ctx, birdForDraw, 0);

        // Score HUD
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.shadowColor = "rgba(255,255,255,0.3)";
        ctx.shadowBlur = 12;
        ctx.font = "bold 52px system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillText(String(scoreRef.current), width / 2, 18);
        ctx.shadowBlur = 0;
      }

      if (state === "gameover") {
        for (const pipe of pipesRef.current) drawPipe(ctx, pipe);
        const birdForDraw = { ...birdRef.current, y: birdRef.current.y - cameraYRef.current };
        drawBird(ctx, birdForDraw, 0);

        // Dark overlay with blur feel
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, 0, width, height);

        // Best score
        const sessions = getSessions();
        const bestScore = sessions
          .filter((s) => s.gameId === "flappy-bird")
          .reduce((best, s) => Math.max(best, s.score ?? 0), 0);

        // Panel
        const panelW = width - 60, panelH = 300;
        const panelX = 30, panelY = height / 2 - panelH / 2;
        const panelGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
        panelGrad.addColorStop(0, "rgba(17,17,30,0.98)");
        panelGrad.addColorStop(1, "rgba(10,12,22,0.98)");
        ctx.fillStyle = panelGrad;
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 18);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // "Game Over"
        ctx.shadowColor = "#EF4444";
        ctx.shadowBlur = 20;
        ctx.font = "bold 28px system-ui, sans-serif";
        ctx.fillStyle = "#EF4444";
        ctx.fillText("Game Over", width / 2, panelY + 38);
        ctx.shadowBlur = 0;

        // Score
        ctx.font = "bold 56px system-ui, sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(String(scoreRef.current), width / 2, panelY + 95);
        ctx.font = "10px system-ui, sans-serif";
        ctx.fillStyle = "#888888";
        ctx.fillText("SCORE", width / 2, panelY + 125);

        // Best score display
        if (bestScore > 0) {
          ctx.font = "11px system-ui, sans-serif";
          ctx.fillStyle = "rgba(255,200,50,0.7)";
          ctx.fillText(`Best: ${bestScore}`, width / 2, panelY + 145);
        }

        // Failed rule
        const failed = failedRuleRef.current;
        if (failed) {
          const ruleY = panelY + 172;
          ctx.font = "bold 13px system-ui, sans-serif";
          ctx.fillStyle = "#F59E0B";
          ctx.fillText(failed.rule, width / 2, ruleY, panelW - 30);

          ctx.font = "bold 12px system-ui, sans-serif";
          ctx.fillStyle = failed.isTrue ? "#1DB97C" : "#EF4444";
          ctx.fillText(`Answer: ${failed.isTrue ? "TRUE ✓" : "FALSE ✗"}`, width / 2, ruleY + 22);

          ctx.font = "11px system-ui, sans-serif";
          ctx.fillStyle = "rgba(180,180,200,0.7)";
          const words = (failed.description ?? "").split(" ");
          let line = "", lineY = ruleY + 44;
          for (const word of words) {
            const test = line + word + " ";
            if (ctx.measureText(test).width > panelW - 40 && line.length > 0) {
              ctx.fillText(line.trim(), width / 2, lineY, panelW - 40);
              line = word + " "; lineY += 17;
            } else line = test;
          }
          if (line.trim()) ctx.fillText(line.trim(), width / 2, lineY, panelW - 40);
        }

        // Play Again button
        const btnY = height * 0.82;
        const btnW = 160, btnH = 44;
        const btnGrad = ctx.createLinearGradient(width / 2 - btnW / 2, btnY, width / 2 + btnW / 2, btnY);
        btnGrad.addColorStop(0, "#1DB97C");
        btnGrad.addColorStop(1, "#16a06a");
        ctx.fillStyle = btnGrad;
        ctx.shadowColor = "rgba(29,185,124,0.4)";
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.roundRect(width / 2 - btnW / 2, btnY - btnH / 2, btnW, btnH, 12);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.font = "bold 15px system-ui, sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.fillText("Play Again", width / 2, btnY);
      }

      if (shakeRef.current > 0) ctx.restore();
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [drawBackground, drawBird, drawPipe, getSpeed, rules, spawnPipe]);

  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const w = Math.min(rect.width, 480);
      const h = Math.min(rect.height, 720);
      canvasSizeRef.current = { width: w, height: h };
      if (gameStateRef.current === "idle") birdRef.current.y = h / 2;
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        if (gameStateRef.current === "gameover") restart();
        else flap();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [flap, restart]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameStateRef.current === "gameover") {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvasSizeRef.current.width / rect.width;
      const scaleY = canvasSizeRef.current.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const btnY = canvasSizeRef.current.height * 0.82;
      const hw = canvasSizeRef.current.width / 2;
      if (x > hw - 80 && x < hw + 80 && y > btnY - 22 && y < btnY + 22) restart();
      return;
    }
    flap();
  }, [flap, restart]);

  const handleCanvasTouch = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (gameStateRef.current === "gameover") {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0] || e.changedTouches[0];
      if (!touch) return;
      const x = (touch.clientX - rect.left) * (canvasSizeRef.current.width / rect.width);
      const y = (touch.clientY - rect.top) * (canvasSizeRef.current.height / rect.height);
      const btnY = canvasSizeRef.current.height * 0.82;
      const hw = canvasSizeRef.current.width / 2;
      if (x > hw - 80 && x < hw + 80 && y > btnY - 22 && y < btnY + 22) restart();
      return;
    }
    flap();
  }, [flap, restart]);

  return (
    <div ref={containerRef} className="w-full max-w-[480px] h-[720px] max-h-[80vh] relative select-none">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onTouchStart={handleCanvasTouch}
        className="w-full h-full rounded-2xl cursor-pointer"
        style={{ touchAction: "none" }}
      />
    </div>
  );
}
