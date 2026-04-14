"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { MentorConfig } from "@/lib/types";
import { recordSession, getSessions } from "@/lib/stats";
import { getSettings, saveSettings } from "@/lib/settings";

// ── Constants ─────────────────────────────────────────────────────────────────
const CELL_SIZE = 54;
const PLAYER_SIZE = 34;
const COLS = 10;
const CANVAS_WIDTH = 540;
const CANVAS_HEIGHT = 640;
const VISIBLE_ROWS = Math.ceil(CANVAS_HEIGHT / CELL_SIZE) + 3;
const ITEM_H = 32;
const ITEM_RADIUS = 6;
const ITEM_PAD = 14;

// Auto-scroll: ms it takes for the scroll to advance one full row
const SCROLL_SPEED_MS: Record<"slow" | "normal" | "fast", number> = {
  slow: 12000,
  normal: 7000,
  fast: 3500,
};

// ── Lane types ────────────────────────────────────────────────────────────────
type LaneType = "safe" | "road" | "river" | "train";
type GamePhase = "start" | "playing" | "gameover";

interface TrafficItem {
  x: number;
  label: string;
  isValid: boolean;
  explanation?: string;
  width: number;
}

interface Log {
  x: number;
  width: number;
}

interface Lane {
  row: number;
  type: LaneType;
  direction: 1 | -1;
  speed: number;
  /** road lanes */
  items: TrafficItem[];
  /** river lanes */
  logs: Log[];
  /** train lane: single x position */
  trainX: number;
  trainWidth: number;
}

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; color: string; r: number;
}

// Rider state: player is standing on a log
interface RideState {
  laneRow: number;
  logIndex: number;
  relX: number; // player pixel X relative to log.x at the moment they stepped on
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function rrPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
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

// ── Determine lane type from row number ───────────────────────────────────────
function laneTypeForRow(row: number): LaneType {
  if (row === 0) return "safe";
  // Train every ~15 rows starting at row 15
  if (row >= 15 && row % 15 === 0) return "train";
  const cycle = row % 10;
  // 0→safe, 1-2→road, 3-4→river, 5→safe, 6-7→road, 8→road or river, 9→safe
  if (cycle === 0 || cycle === 5 || cycle === 9) return "safe";
  if (cycle === 3 || cycle === 4) return "river";
  if (cycle === 8) return Math.random() < 0.5 ? "road" : "river";
  return "road";
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CrossyRoadGame({ config }: { config: MentorConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<GamePhase>("start");
  const [phase, setPhase] = useState<GamePhase>("start");

  // Speed setting (read once; changes via start screen re-read from ref)
  const speedSettingRef = useRef<"slow" | "normal" | "fast">(
    getSettings()["crossy-road"].speed,
  );
  const [speedSetting, setSpeedSetting] = useState<"slow" | "normal" | "fast">(
    speedSettingRef.current,
  );

  // Best score from past sessions
  const [bestScore, setBestScore] = useState<number>(0);
  useEffect(() => {
    const sessions = getSessions().filter((s) => s.gameId === "crossy-road");
    if (sessions.length > 0) {
      setBestScore(Math.max(...sessions.map((s) => s.score ?? 0)));
    }
  }, []);

  const deathInfoRef = useRef<{ label: string; isValid: boolean; explanation?: string } | null>(null);
  const deathReasonRef = useRef<"traffic" | "river" | "train" | "scroll" | null>(null);

  // Player position in grid coords
  const playerRef = useRef({ col: Math.floor(COLS / 2), row: 0 });
  // Player pixel X (used for log riding — overrides col-based calc while riding)
  const playerPixelXRef = useRef<number | null>(null);
  const maxRowRef = useRef(0);

  // Auto-scroll: world row that forms the bottom edge of the camera
  const autoScrollRowRef = useRef(0); // fractional; camera bottom = autoScrollRowRef * CELL_SIZE
  const lastScrollTimeRef = useRef(0);

  // Log-riding state
  const rideStateRef = useRef<RideState | null>(null);

  const lanesRef = useRef<Map<number, Lane>>(new Map());
  const frameRef = useRef<number>(0);
  const deathFlashRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const sessionStartRef = useRef(0);
  const concepts = config.concepts;

  // Measure canvas
  const measureRef = useRef<CanvasRenderingContext2D | null>(null);
  function measureText(text: string): number {
    if (!measureRef.current) {
      const c = document.createElement("canvas");
      const ctx2 = c.getContext("2d");
      if (ctx2) { ctx2.font = `bold 11px system-ui, sans-serif`; measureRef.current = ctx2; }
    }
    return (measureRef.current?.measureText(text).width ?? text.length * 7) + ITEM_PAD * 2;
  }

  // ── Lane generation ─────────────────────────────────────────────────────────
  function getLane(row: number): Lane {
    const existing = lanesRef.current.get(row);
    if (existing) return existing;

    const type = laneTypeForRow(row);
    const direction = Math.random() < 0.5 ? (1 as const) : (-1 as const);

    // Speed increases with row but caps out
    const baseSpeed = 0.6 + Math.min(row * 0.035, 3.5);
    const speed = baseSpeed + Math.random() * 0.5;

    const items: TrafficItem[] = [];
    const logs: Log[] = [];
    let trainX = -600;
    const trainWidth = CANVAS_WIDTH * 1.0; // full-width train

    if (type === "road" && concepts.length > 0) {
      const count = 2 + Math.floor(Math.random() * 3);
      const spacing = CANVAS_WIDTH / count;
      for (let i = 0; i < count; i++) {
        const concept = concepts[Math.floor(Math.random() * concepts.length)];
        const w = Math.min(measureText(concept.label), CANVAS_WIDTH * 0.42);
        items.push({
          x: i * spacing + Math.random() * spacing * 0.35,
          label: concept.label,
          isValid: concept.isValid,
          explanation: concept.explanation,
          width: w,
        });
      }
    }

    if (type === "river") {
      // 2–4 logs of varying widths
      const count = 2 + Math.floor(Math.random() * 3);
      const spacing = CANVAS_WIDTH / count;
      for (let i = 0; i < count; i++) {
        const w = 70 + Math.floor(Math.random() * 60); // 70–130px
        logs.push({
          x: i * spacing + Math.random() * (spacing - w),
          width: w,
        });
      }
    }

    if (type === "train") {
      // Start off-screen in the direction of travel
      trainX = direction === 1 ? -CANVAS_WIDTH - 100 : CANVAS_WIDTH + 100;
    }

    const lane: Lane = { row, type, direction, speed, items, logs, trainX, trainWidth };
    lanesRef.current.set(row, lane);
    return lane;
  }

  // ── Particles ───────────────────────────────────────────────────────────────
  function spawnParticles(x: number, y: number, colors?: string[]) {
    const c = colors ?? ["#EF4444", "#f87171", "#fca5a5", "#F59E0B"];
    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.5;
      const spd = 2 + Math.random() * 4;
      particlesRef.current.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 2.5,
        life: 1,
        color: c[Math.floor(Math.random() * c.length)],
        r: 3 + Math.random() * 3,
      });
    }
  }

  // ── Kill player ─────────────────────────────────────────────────────────────
  function killPlayer(reason: "traffic" | "river" | "train" | "scroll", deathInfo?: { label: string; isValid: boolean; explanation?: string }) {
    if (phaseRef.current !== "playing") return;
    phaseRef.current = "gameover";
    deathReasonRef.current = reason;
    deathInfoRef.current = deathInfo ?? null;
    recordSession({
      gameId: "crossy-road",
      gameName: "Crossy Road",
      mentorId: config.id,
      timestamp: Date.now(),
      durationMs: performance.now() - sessionStartRef.current,
      score: maxRowRef.current,
    });
    // Update best score in state (optimistic)
    setBestScore((prev) => Math.max(prev, maxRowRef.current));
    setPhase("gameover");
    deathFlashRef.current = 1;

    // Compute screen position for particle explosion
    const player = playerRef.current;
    const cameraBottom = autoScrollRowRef.current;
    const px = playerPixelXRef.current ?? (player.col * CELL_SIZE + (CELL_SIZE - PLAYER_SIZE) / 2);
    const screenY = CANVAS_HEIGHT - (player.row - cameraBottom) * CELL_SIZE - CELL_SIZE + (CELL_SIZE - PLAYER_SIZE) / 2;
    spawnParticles(px + PLAYER_SIZE / 2, screenY + PLAYER_SIZE / 2);
  }

  // ── Reset ───────────────────────────────────────────────────────────────────
  const resetGame = useCallback(() => {
    // Re-read speed setting in case it changed
    speedSettingRef.current = getSettings()["crossy-road"].speed;
    playerRef.current = { col: Math.floor(COLS / 2), row: 0 };
    playerPixelXRef.current = null;
    maxRowRef.current = 0;
    autoScrollRowRef.current = 0;
    lastScrollTimeRef.current = performance.now();
    rideStateRef.current = null;
    lanesRef.current.clear();
    deathInfoRef.current = null;
    deathReasonRef.current = null;
    deathFlashRef.current = 0;
    particlesRef.current = [];
    sessionStartRef.current = performance.now();
    phaseRef.current = "playing";
    setPhase("playing");
  }, []);

  // ── Keyboard handler ─────────────────────────────────────────────────────────
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (phaseRef.current === "start") {
        if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","w","a","s","d"].includes(e.key.toLowerCase())) {
          resetGame();
        }
        return;
      }
      if (phaseRef.current === "gameover") {
        if (e.key === " " || e.key === "Enter") resetGame();
        return;
      }

      const p = playerRef.current;
      let moved = false;

      switch (e.key) {
        case "ArrowUp": case "w": case "W": {
          p.row += 1;
          playerPixelXRef.current = null; // recalc from col
          rideStateRef.current = null;    // leaving old row
          if (p.row > maxRowRef.current) maxRowRef.current = p.row;
          moved = true;
          break;
        }
        case "ArrowDown": case "s": case "S": {
          if (p.row > 0) {
            p.row -= 1;
            playerPixelXRef.current = null;
            rideStateRef.current = null;
            moved = true;
          }
          break;
        }
        case "ArrowLeft": case "a": case "A": {
          if (p.col > 0) { p.col -= 1; moved = true; }
          break;
        }
        case "ArrowRight": case "d": case "D": {
          if (p.col < COLS - 1) { p.col += 1; moved = true; }
          break;
        }
      }

      if (moved) {
        e.preventDefault();
        // After horizontal movement, recalculate pixel X from col
        if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A" ||
            e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
          // Sync pixel X to col
          playerPixelXRef.current = p.col * CELL_SIZE + (CELL_SIZE - PLAYER_SIZE) / 2;
          // If on a river lane check if still on log
          checkRiverEntry();
        }
        // After vertical movement into new row, check the new row
        if (e.key === "ArrowUp" || e.key === "w" || e.key === "W" ||
            e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
          checkRiverEntry();
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetGame]);

  // ── River entry check ─────────────────────────────────────────────────────
  function checkRiverEntry() {
    const player = playerRef.current;
    const lane = getLane(player.row);
    if (lane.type !== "river") {
      rideStateRef.current = null;
      return;
    }
    // Player pixel X
    const px = playerPixelXRef.current ?? (player.col * CELL_SIZE + (CELL_SIZE - PLAYER_SIZE) / 2);
    const playerLeft = px;
    const playerRight = px + PLAYER_SIZE;
    const playerCenter = px + PLAYER_SIZE / 2;

    // Find a log the player overlaps
    const logIdx = lane.logs.findIndex((log) => {
      return playerRight > log.x + 4 && playerLeft < log.x + log.width - 4;
    });

    if (logIdx === -1) {
      // Splash — no log
      killPlayer("river");
    } else {
      // Mount log
      rideStateRef.current = {
        laneRow: player.row,
        logIndex: logIdx,
        relX: playerCenter - lane.logs[logIdx].x,
      };
    }
  }

  // ── Main game loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let lastTime = 0;

    function gameLoop(time: number) {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      if (phaseRef.current === "playing") update(dt, time);
      render(ctx!);
      frameRef.current = requestAnimationFrame(gameLoop);
    }

    // ── Update ───────────────────────────────────────────────────────────────
    function update(dt: number, time: number) {
      const player = playerRef.current;

      // Auto-scroll advancement
      const msPerRow = SCROLL_SPEED_MS[speedSettingRef.current];
      const elapsed = time - lastScrollTimeRef.current;
      autoScrollRowRef.current = elapsed / msPerRow;

      // ── Scroll death check: player must stay above scroll bottom ────────────
      // autoScrollRowRef is the world row at the bottom of the camera.
      // If player.row < autoScrollRowRef - 1 → crushed
      if (player.row < autoScrollRowRef.current - 1) {
        killPlayer("scroll");
        return;
      }

      const startRow = Math.max(0, Math.floor(autoScrollRowRef.current) - 1);
      const endRow = startRow + VISIBLE_ROWS + 2;

      // ── Move all lanes' objects ─────────────────────────────────────────────
      for (let r = startRow; r <= endRow; r++) {
        const lane = getLane(r);
        if (lane.type === "road") {
          for (const item of lane.items) {
            item.x += lane.direction * lane.speed * dt * 60;
            if (lane.direction === 1 && item.x > CANVAS_WIDTH + item.width) item.x = -item.width;
            else if (lane.direction === -1 && item.x < -item.width) item.x = CANVAS_WIDTH + item.width;
          }
        } else if (lane.type === "river") {
          for (const log of lane.logs) {
            log.x += lane.direction * (lane.speed * 0.55) * dt * 60;
            if (lane.direction === 1 && log.x > CANVAS_WIDTH + log.width) log.x = -log.width;
            else if (lane.direction === -1 && log.x < -log.width) log.x = CANVAS_WIDTH + log.width;
          }
        } else if (lane.type === "train") {
          const trainSpeed = (lane.speed * 5) * dt * 60;
          lane.trainX += lane.direction * trainSpeed;
          // Wrap: if fully off screen in travel direction, reset from other side
          if (lane.direction === 1 && lane.trainX > CANVAS_WIDTH + 20) {
            lane.trainX = -lane.trainWidth - 20;
          } else if (lane.direction === -1 && lane.trainX < -lane.trainWidth - 20) {
            lane.trainX = CANVAS_WIDTH + 20;
          }
        }
      }

      // ── Log riding ──────────────────────────────────────────────────────────
      const rideState = rideStateRef.current;
      if (rideState && rideState.laneRow === player.row) {
        const rideLane = getLane(player.row);
        if (rideLane.type === "river") {
          const log = rideLane.logs[rideState.logIndex];
          if (log) {
            // Player center tracks log
            const newCenter = log.x + rideState.relX;
            playerPixelXRef.current = newCenter - PLAYER_SIZE / 2;
            // Update player col to reflect position (for rendering + other checks)
            player.col = Math.round((playerPixelXRef.current) / CELL_SIZE);
            player.col = Math.max(0, Math.min(COLS - 1, player.col));

            // Check if log has drifted player off screen
            const px = playerPixelXRef.current;
            if (px + PLAYER_SIZE < 0 || px > CANVAS_WIDTH) {
              killPlayer("river");
              return;
            }
          }
        }
      }

      // ── Particles ───────────────────────────────────────────────────────────
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life -= 0.04;
        if (p.life <= 0) particlesRef.current.splice(i, 1);
      }

      // ── Collision detection ──────────────────────────────────────────────────
      const lane = getLane(player.row);
      const px = playerPixelXRef.current ?? (player.col * CELL_SIZE + (CELL_SIZE - PLAYER_SIZE) / 2);

      if (lane.type === "road") {
        for (const item of lane.items) {
          if (!item.isValid && px + PLAYER_SIZE > item.x + 6 && px < item.x + item.width - 6) {
            killPlayer("traffic", { label: item.label, isValid: item.isValid, explanation: item.explanation });
            return;
          }
        }
      } else if (lane.type === "train") {
        // Train occupies trainX .. trainX + trainWidth
        if (px + PLAYER_SIZE > lane.trainX + 8 && px < lane.trainX + lane.trainWidth - 8) {
          killPlayer("train");
          return;
        }
      }
      // River collision handled in checkRiverEntry; log drift kill handled above
    }

    // ── Render ──────────────────────────────────────────────────────────────
    function render(ctx: CanvasRenderingContext2D) {
      const player = playerRef.current;

      // Camera follows player when they're ahead of auto-scroll.
      // Keep player at least 4 rows from the top of the screen.
      const playerBasedBottom = player.row - (VISIBLE_ROWS - 4);
      const cameraBottom = Math.max(autoScrollRowRef.current, Math.max(0, playerBasedBottom));

      // Camera: bottom of screen = cameraBottom world row
      // screenY for world row r = CANVAS_HEIGHT - (r - cameraBottom) * CELL_SIZE - CELL_SIZE
      function rowScreenY(r: number) {
        return CANVAS_HEIGHT - (r - cameraBottom) * CELL_SIZE - CELL_SIZE;
      }

      const startRow = Math.max(0, Math.floor(cameraBottom) - 1);
      const endRow = startRow + VISIBLE_ROWS + 2;

      // Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      bgGrad.addColorStop(0, "#060610");
      bgGrad.addColorStop(1, "#0a0a18");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // ── Draw lanes ──────────────────────────────────────────────────────────
      for (let r = startRow; r <= endRow; r++) {
        const lane = getLane(r);
        const screenY = rowScreenY(r);
        if (screenY > CANVAS_HEIGHT + CELL_SIZE || screenY < -CELL_SIZE * 2) continue;

        if (lane.type === "safe") {
          // Grass
          const grassGrad = ctx.createLinearGradient(0, screenY, 0, screenY + CELL_SIZE);
          grassGrad.addColorStop(0, "#0d2410");
          grassGrad.addColorStop(0.5, "#0f2812");
          grassGrad.addColorStop(1, "#0b1e0d");
          ctx.fillStyle = grassGrad;
          ctx.fillRect(0, screenY, CANVAS_WIDTH, CELL_SIZE);
          // Blade detail
          ctx.fillStyle = "rgba(29,185,124,0.06)";
          for (let gx = 6; gx < CANVAS_WIDTH; gx += 14) {
            const bladH = 6 + (gx % 3) * 3;
            ctx.fillRect(gx, screenY + 4, 2, bladH);
            ctx.fillRect(gx + 6, screenY + CELL_SIZE - 4 - bladH, 2, bladH);
          }
          ctx.fillStyle = "rgba(29,185,124,0.12)";
          ctx.fillRect(0, screenY, CANVAS_WIDTH, 2);
          ctx.fillRect(0, screenY + CELL_SIZE - 2, CANVAS_WIDTH, 2);

        } else if (lane.type === "road") {
          // Road asphalt
          const roadGrad = ctx.createLinearGradient(0, screenY, 0, screenY + CELL_SIZE);
          roadGrad.addColorStop(0, "#111118");
          roadGrad.addColorStop(0.5, "#141420");
          roadGrad.addColorStop(1, "#111118");
          ctx.fillStyle = roadGrad;
          ctx.fillRect(0, screenY, CANVAS_WIDTH, CELL_SIZE);
          // Amber curb strips
          ctx.fillStyle = "rgba(245,158,11,0.5)";
          ctx.fillRect(0, screenY, CANVAS_WIDTH, 2);
          ctx.fillRect(0, screenY + CELL_SIZE - 2, CANVAS_WIDTH, 2);
          // Center dash
          ctx.strokeStyle = "rgba(255,255,255,0.12)";
          ctx.lineWidth = 2;
          ctx.setLineDash([10, 14]);
          ctx.beginPath();
          ctx.moveTo(0, screenY + CELL_SIZE / 2);
          ctx.lineTo(CANVAS_WIDTH, screenY + CELL_SIZE / 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // Traffic items (vehicles)
          for (const item of lane.items) {
            drawVehicle(ctx, item, screenY, lane.direction);
          }

        } else if (lane.type === "river") {
          // River background
          const riverGrad = ctx.createLinearGradient(0, screenY, 0, screenY + CELL_SIZE);
          riverGrad.addColorStop(0, "#0a1a3a");
          riverGrad.addColorStop(0.5, "#0c1e44");
          riverGrad.addColorStop(1, "#0a1a3a");
          ctx.fillStyle = riverGrad;
          ctx.fillRect(0, screenY, CANVAS_WIDTH, CELL_SIZE);
          // Water shimmer lines
          ctx.strokeStyle = "rgba(30,100,200,0.18)";
          ctx.lineWidth = 1;
          ctx.setLineDash([8, 20]);
          for (let wy = screenY + 8; wy < screenY + CELL_SIZE - 4; wy += 12) {
            ctx.beginPath();
            ctx.moveTo(0, wy);
            ctx.lineTo(CANVAS_WIDTH, wy);
            ctx.stroke();
          }
          ctx.setLineDash([]);
          // River edge strips
          ctx.fillStyle = "rgba(20,80,160,0.35)";
          ctx.fillRect(0, screenY, CANVAS_WIDTH, 2);
          ctx.fillRect(0, screenY + CELL_SIZE - 2, CANVAS_WIDTH, 2);

          // Logs
          for (const log of lane.logs) {
            drawLog(ctx, log.x, screenY, log.width, CELL_SIZE);
          }

        } else if (lane.type === "train") {
          // Track background
          ctx.fillStyle = "#1a1a22";
          ctx.fillRect(0, screenY, CANVAS_WIDTH, CELL_SIZE);
          // Rail ties
          ctx.fillStyle = "#2a2a32";
          for (let tx = 0; tx < CANVAS_WIDTH; tx += 18) {
            ctx.fillRect(tx, screenY + 4, 10, CELL_SIZE - 8);
          }
          // Steel rails
          ctx.fillStyle = "#555566";
          ctx.fillRect(0, screenY + 10, CANVAS_WIDTH, 4);
          ctx.fillRect(0, screenY + CELL_SIZE - 14, CANVAS_WIDTH, 4);
          // Danger strips at edge
          ctx.fillStyle = "rgba(239,68,68,0.4)";
          ctx.fillRect(0, screenY, CANVAS_WIDTH, 2);
          ctx.fillRect(0, screenY + CELL_SIZE - 2, CANVAS_WIDTH, 2);

          // Train
          drawTrain(ctx, lane.trainX, screenY, lane.trainWidth, CELL_SIZE, lane.direction);
        }
      }

      // ── Particles ──────────────────────────────────────────────────────────
      for (const p of particlesRef.current) {
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

      // Death flash
      if (deathFlashRef.current > 0) {
        ctx.fillStyle = `rgba(239,68,68,${deathFlashRef.current * 0.3})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        if (phaseRef.current === "playing") deathFlashRef.current -= 0.04;
      }

      // ── Player ─────────────────────────────────────────────────────────────
      if (phaseRef.current !== "start") {
        const rawPx = playerPixelXRef.current ?? (player.col * CELL_SIZE + (CELL_SIZE - PLAYER_SIZE) / 2);
        const playerScreenY = rowScreenY(player.row) + (CELL_SIZE - PLAYER_SIZE) / 2;
        drawPlayer(ctx, rawPx, playerScreenY);
      }

      // ── HUD ────────────────────────────────────────────────────────────────
      ctx.fillStyle = "rgba(8,8,20,0.85)";
      ctx.fillRect(0, 0, CANVAS_WIDTH, 50);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 50); ctx.lineTo(CANVAS_WIDTH, 50);
      ctx.stroke();

      // Score (center)
      ctx.fillStyle = "#1DB97C";
      ctx.font = "bold 22px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(maxRowRef.current), CANVAS_WIDTH / 2, 25);
      ctx.fillStyle = "#666680";
      ctx.font = "7px monospace";
      ctx.letterSpacing = "0.1em";
      ctx.fillText("ROWS CROSSED", CANVAS_WIDTH / 2, 41);
      ctx.letterSpacing = "0";

      // Best score (right)
      const bestVal = Math.max(maxRowRef.current, bestScore);
      ctx.fillStyle = "#F59E0B";
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(`BEST: ${bestVal}`, CANVAS_WIDTH - 12, 25);

      // Speed indicator (left)
      ctx.fillStyle = "#555577";
      ctx.font = "7px monospace";
      ctx.letterSpacing = "0.08em";
      ctx.textAlign = "left";
      ctx.fillText(speedSettingRef.current.toUpperCase(), 12, 25);
      ctx.letterSpacing = "0";

      // ── Start overlay ──────────────────────────────────────────────────────
      if (phaseRef.current === "start") {
        ctx.fillStyle = "rgba(5,5,15,0.92)";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        const cardX = 36, cardY = 70, cardW = CANVAS_WIDTH - 72, cardH = 420;
        const panelGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
        panelGrad.addColorStop(0, "rgba(17,17,30,0.99)");
        panelGrad.addColorStop(1, "rgba(10,10,20,0.99)");
        ctx.fillStyle = panelGrad;
        rrPath(ctx, cardX, cardY, cardW, cardH, 20);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.07)";
        ctx.lineWidth = 1;
        rrPath(ctx, cardX, cardY, cardW, cardH, 20);
        ctx.stroke();

        // Title
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 28px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("CROSSY ROAD", CANVAS_WIDTH / 2, cardY + 44);

        ctx.fillStyle = "#1DB97C";
        ctx.font = "bold 8px monospace";
        ctx.letterSpacing = "0.15em";
        ctx.fillText("TRADING EDITION", CANVAS_WIDTH / 2, cardY + 70);
        ctx.letterSpacing = "0";

        // Best score on start screen
        ctx.fillStyle = "#F59E0B";
        ctx.font = "bold 13px monospace";
        ctx.fillText(`Best: ${bestScore}`, CANVAS_WIDTH / 2, cardY + 96);

        // Instructions
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.font = "11px sans-serif";
        ctx.fillText("Arrow keys / WASD to move", CANVAS_WIDTH / 2, cardY + 124);

        // Legend
        const legY = cardY + 154;
        ctx.fillStyle = "#34d399";
        ctx.font = "bold 10px sans-serif";
        ctx.fillText("Cross valid concepts (green)", CANVAS_WIDTH / 2, legY);
        ctx.fillStyle = "#f87171";
        ctx.fillText("Avoid invalid concepts (red)", CANVAS_WIDTH / 2, legY + 20);
        ctx.fillStyle = "#60a5fa";
        ctx.fillText("Jump on logs in rivers", CANVAS_WIDTH / 2, legY + 40);
        ctx.fillStyle = "#f97316";
        ctx.fillText("Watch for trains!", CANVAS_WIDTH / 2, legY + 60);

        // Speed selector label
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "9px monospace";
        ctx.letterSpacing = "0.1em";
        ctx.fillText("SCROLL SPEED", CANVAS_WIDTH / 2, legY + 96);
        ctx.letterSpacing = "0";

        // Speed buttons — drawn at fixed coords; click handled in handleCanvasClick
        const speeds: Array<"slow" | "normal" | "fast"> = ["slow", "normal", "fast"];
        const btnW = 82, btnH = 34, btnGap = 10;
        const totalW = speeds.length * btnW + (speeds.length - 1) * btnGap;
        const btnStartX = (CANVAS_WIDTH - totalW) / 2;
        const btnY2 = legY + 110;

        for (let si = 0; si < speeds.length; si++) {
          const spd = speeds[si];
          const bx = btnStartX + si * (btnW + btnGap);
          const isActive = speedSetting === spd;

          if (isActive) {
            const grd = ctx.createLinearGradient(bx, btnY2, bx, btnY2 + btnH);
            grd.addColorStop(0, "#22c55e");
            grd.addColorStop(1, "#1DB97C");
            ctx.fillStyle = grd;
            ctx.shadowColor = "rgba(29,185,124,0.5)";
            ctx.shadowBlur = 12;
          } else {
            ctx.fillStyle = "rgba(30,30,50,0.9)";
            ctx.shadowBlur = 0;
          }
          rrPath(ctx, bx, btnY2, btnW, btnH, 10);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = isActive ? "#1DB97C" : "rgba(255,255,255,0.12)";
          ctx.lineWidth = 1;
          rrPath(ctx, bx, btnY2, btnW, btnH, 10);
          ctx.stroke();
          ctx.fillStyle = isActive ? "#ffffff" : "rgba(255,255,255,0.45)";
          ctx.font = `${isActive ? "bold " : ""}12px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(spd.charAt(0).toUpperCase() + spd.slice(1), bx + btnW / 2, btnY2 + btnH / 2);
        }

        // Start button
        const stBtnX = CANVAS_WIDTH / 2 - 90;
        const stBtnY = cardY + cardH - 68;
        const stGrad = ctx.createLinearGradient(stBtnX, stBtnY, stBtnX, stBtnY + 44);
        stGrad.addColorStop(0, "#22c55e");
        stGrad.addColorStop(1, "#1DB97C");
        ctx.fillStyle = stGrad;
        ctx.shadowColor = "rgba(29,185,124,0.5)";
        ctx.shadowBlur = 16;
        rrPath(ctx, stBtnX, stBtnY, 180, 44, 22);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        rrPath(ctx, stBtnX + 5, stBtnY + 4, 170, 18, 14);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("PRESS ANY KEY TO START", CANVAS_WIDTH / 2, stBtnY + 22);
      }

      // ── Game over overlay ──────────────────────────────────────────────────
      if (phaseRef.current === "gameover") {
        ctx.fillStyle = "rgba(5,5,15,0.93)";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        const ovX = 38, ovY = 90, ovW = CANVAS_WIDTH - 76, ovH = 380;
        const ovGrad = ctx.createLinearGradient(ovX, ovY, ovX, ovY + ovH);
        ovGrad.addColorStop(0, "rgba(20,8,8,0.99)");
        ovGrad.addColorStop(1, "rgba(10,10,20,0.99)");
        ctx.fillStyle = ovGrad;
        ctx.shadowColor = "rgba(239,68,68,0.22)";
        ctx.shadowBlur = 30;
        rrPath(ctx, ovX, ovY, ovW, ovH, 20);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(239,68,68,0.22)";
        ctx.lineWidth = 1;
        rrPath(ctx, ovX, ovY, ovW, ovH, 20);
        ctx.stroke();

        ctx.fillStyle = "#EF4444";
        ctx.font = "bold 30px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("GAME OVER", CANVAS_WIDTH / 2, ovY + 40);

        ctx.fillStyle = "#888888";
        ctx.font = "7px monospace";
        ctx.letterSpacing = "0.12em";
        ctx.fillText("ROWS CROSSED", CANVAS_WIDTH / 2, ovY + 74);
        ctx.letterSpacing = "0";

        ctx.fillStyle = "#1DB97C";
        ctx.font = "bold 52px monospace";
        ctx.fillText(String(maxRowRef.current), CANVAS_WIDTH / 2, ovY + 126);

        // Best score
        const finalBest = Math.max(maxRowRef.current, bestScore);
        ctx.fillStyle = "#F59E0B";
        ctx.font = "bold 13px monospace";
        ctx.fillText(`Best: ${finalBest}`, CANVAS_WIDTH / 2, ovY + 166);

        // Death reason
        const reason = deathReasonRef.current;
        const info = deathInfoRef.current;
        if (reason === "scroll") {
          ctx.fillStyle = "#f87171";
          ctx.font = "bold 10px sans-serif";
          ctx.fillText("Scrolled off screen!", CANVAS_WIDTH / 2, ovY + 196);
        } else if (reason === "river") {
          ctx.fillStyle = "#60a5fa";
          ctx.font = "bold 10px sans-serif";
          ctx.fillText("Fell in the river!", CANVAS_WIDTH / 2, ovY + 196);
        } else if (reason === "train") {
          ctx.fillStyle = "#f97316";
          ctx.font = "bold 10px sans-serif";
          ctx.fillText("Hit by a train!", CANVAS_WIDTH / 2, ovY + 196);
        } else if (info) {
          ctx.fillStyle = "#F59E0B";
          ctx.font = "bold 10px sans-serif";
          ctx.fillText(`Eliminated by: "${info.label}"`, CANVAS_WIDTH / 2, ovY + 196);
          if (info.explanation) {
            ctx.fillStyle = "#555577";
            ctx.font = "9px sans-serif";
            const words = info.explanation.split(" ");
            let line = "";
            let lineY = ovY + 214;
            for (const word of words) {
              const test = (line ? line + " " : "") + word;
              if (test.length > 40) {
                ctx.fillText(line.trim(), CANVAS_WIDTH / 2, lineY);
                line = word; lineY += 14;
              } else { line = test; }
            }
            if (line.trim()) ctx.fillText(line.trim(), CANVAS_WIDTH / 2, lineY);
          }
        }

        // Play again button
        const paX = CANVAS_WIDTH / 2 - 85, paY = ovY + ovH - 62;
        const paGrad = ctx.createLinearGradient(paX, paY, paX, paY + 44);
        paGrad.addColorStop(0, "#22c55e");
        paGrad.addColorStop(1, "#1DB97C");
        ctx.fillStyle = paGrad;
        ctx.shadowColor = "rgba(29,185,124,0.45)";
        ctx.shadowBlur = 14;
        rrPath(ctx, paX, paY, 170, 44, 22);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        rrPath(ctx, paX + 5, paY + 4, 160, 18, 14);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("PLAY AGAIN", CANVAS_WIDTH / 2, paY + 22);
      }
    }

    frameRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(frameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Draw helpers (called from render) ─────────────────────────────────────
  function drawVehicle(
    ctx: CanvasRenderingContext2D,
    item: TrafficItem,
    screenY: number,
    direction: 1 | -1,
  ) {
    const ix = item.x;
    const iy = screenY + (CELL_SIZE - ITEM_H) / 2;
    const accentColor = item.isValid ? "#1DB97C" : "#EF4444";
    const accentBright = item.isValid ? "#34d399" : "#f87171";
    const bodyDark = item.isValid ? "#062010" : "#180608";

    ctx.save();
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 10;

    rrPath(ctx, ix, iy, item.width, ITEM_H, ITEM_RADIUS);
    const vGrad = ctx.createLinearGradient(ix, iy, ix, iy + ITEM_H);
    vGrad.addColorStop(0, `${accentColor}44`);
    vGrad.addColorStop(0.4, bodyDark);
    vGrad.addColorStop(1, `${accentColor}22`);
    ctx.fillStyle = vGrad;
    ctx.fill();

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5;
    rrPath(ctx, ix, iy, item.width, ITEM_H, ITEM_RADIUS);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = `${accentBright}20`;
    rrPath(ctx, ix + 4, iy + 3, item.width - 8, ITEM_H * 0.38, ITEM_RADIUS * 0.7);
    ctx.fill();

    const lightSide = direction === 1 ? ix + item.width - 8 : ix + 4;
    ctx.fillStyle = "rgba(255,240,180,0.9)";
    ctx.shadowColor = "rgba(255,240,180,0.7)";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.ellipse(lightSide, iy + 6, 2.5, 2, 0, 0, Math.PI * 2);
    ctx.ellipse(lightSide, iy + ITEM_H - 6, 2.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 3;
    ctx.fillText(item.label, ix + item.width / 2, iy + ITEM_H / 2, item.width - ITEM_PAD * 2 - 10);
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  function drawLog(
    ctx: CanvasRenderingContext2D,
    lx: number, screenY: number, lw: number, lh: number,
  ) {
    const ly = screenY + 5;
    const lHeight = lh - 10;

    ctx.save();
    ctx.shadowColor = "#1a4060";
    ctx.shadowBlur = 8;

    const logGrad = ctx.createLinearGradient(lx, ly, lx, ly + lHeight);
    logGrad.addColorStop(0, "#1e4e70");
    logGrad.addColorStop(0.4, "#1a4060");
    logGrad.addColorStop(1, "#122e48");
    ctx.fillStyle = logGrad;
    rrPath(ctx, lx, ly, lw, lHeight, 6);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Wood grain lines
    ctx.strokeStyle = "rgba(10,25,40,0.5)";
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    for (let gx = lx + 12; gx < lx + lw - 6; gx += 16) {
      ctx.beginPath();
      ctx.moveTo(gx, ly + 3);
      ctx.lineTo(gx, ly + lHeight - 3);
      ctx.stroke();
    }

    // Top sheen
    ctx.fillStyle = "rgba(60,140,200,0.14)";
    rrPath(ctx, lx + 3, ly + 2, lw - 6, lHeight * 0.3, 5);
    ctx.fill();

    ctx.restore();
  }

  function drawTrain(
    ctx: CanvasRenderingContext2D,
    tx: number, screenY: number, tw: number, th: number, direction: 1 | -1,
  ) {
    const ty = screenY + 2;
    const tHeight = th - 4;

    ctx.save();
    ctx.shadowColor = "#cc3300";
    ctx.shadowBlur = 14;

    const trainGrad = ctx.createLinearGradient(tx, ty, tx, ty + tHeight);
    trainGrad.addColorStop(0, "#cc3300");
    trainGrad.addColorStop(0.4, "#991f00");
    trainGrad.addColorStop(1, "#6b1500");
    ctx.fillStyle = trainGrad;
    rrPath(ctx, tx, ty, tw, tHeight, 4);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Train panels / windows
    const panelCount = Math.max(1, Math.floor(tw / 80));
    for (let pi = 0; pi < panelCount; pi++) {
      const wx = tx + pi * (tw / panelCount) + 10;
      const ww = tw / panelCount - 20;
      if (ww > 4) {
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        rrPath(ctx, wx, ty + 6, ww, tHeight - 12, 3);
        ctx.fill();
        ctx.fillStyle = "rgba(60,200,255,0.2)";
        rrPath(ctx, wx, ty + 6, ww, tHeight * 0.4, 2);
        ctx.fill();
      }
    }

    // Headlight
    const hx = direction === 1 ? tx + tw - 12 : tx + 6;
    ctx.fillStyle = "rgba(255,220,100,0.95)";
    ctx.shadowColor = "rgba(255,220,100,0.8)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(hx, ty + tHeight / 2, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  function drawPlayer(ctx: CanvasRenderingContext2D, px: number, py: number) {
    const cx = px + PLAYER_SIZE / 2;
    const cy = py + PLAYER_SIZE / 2;
    const pr = PLAYER_SIZE / 2;

    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(cx, cy + pr + 2, pr * 0.8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.shadowColor = "#F59E0B";
    ctx.shadowBlur = 18;

    const bodyGrad = ctx.createRadialGradient(cx - pr * 0.28, cy - pr * 0.28, pr * 0.05, cx, cy, pr);
    bodyGrad.addColorStop(0, "#fde68a");
    bodyGrad.addColorStop(0.5, "#f59e0b");
    bodyGrad.addColorStop(1, "#92400e");
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    const shineGrad = ctx.createRadialGradient(
      cx - pr * 0.3, cy - pr * 0.35, 0,
      cx - pr * 0.2, cy - pr * 0.25, pr * 0.48,
    );
    shineGrad.addColorStop(0, "rgba(255,255,255,0.5)");
    shineGrad.addColorStop(1, "transparent");
    ctx.fillStyle = shineGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, pr, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1a0a00";
    ctx.beginPath();
    ctx.arc(cx - 5, cy - 3, 3, 0, Math.PI * 2);
    ctx.arc(cx + 5, cy - 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx - 4, cy - 4, 1.5, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy - 4, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#7c3100";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 4.5, 0.15, Math.PI - 0.15);
    ctx.stroke();
  }

  // ── Canvas click handler ──────────────────────────────────────────────────
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top) * scaleY;

      if (phaseRef.current === "start") {
        // Speed button hit test (mirrors positions drawn in render)
        const speeds: Array<"slow" | "normal" | "fast"> = ["slow", "normal", "fast"];
        const btnW = 82, btnH = 34, btnGap = 10;
        const totalW = speeds.length * btnW + (speeds.length - 1) * btnGap;
        const btnStartX = (CANVAS_WIDTH - totalW) / 2;
        const cardY = 70;
        const legY = cardY + 154;
        const btnY2 = legY + 110;

        for (let si = 0; si < speeds.length; si++) {
          const bx = btnStartX + si * (btnW + btnGap);
          if (cx >= bx && cx <= bx + btnW && cy >= btnY2 && cy <= btnY2 + btnH) {
            const newSpeed = speeds[si];
            speedSettingRef.current = newSpeed;
            setSpeedSetting(newSpeed);
            saveSettings({ "crossy-road": { speed: newSpeed } });
            return;
          }
        }

        // Start button
        const stBtnX = CANVAS_WIDTH / 2 - 90;
        const stBtnY = cardY + 420 - 68;
        if (cx >= stBtnX && cx <= stBtnX + 180 && cy >= stBtnY && cy <= stBtnY + 44) {
          resetGame();
        }
        return;
      }

      if (phaseRef.current === "gameover") {
        const ovY = 90, ovH = 380;
        const paX = CANVAS_WIDTH / 2 - 85;
        const paY = ovY + ovH - 62;
        if (cx >= paX && cx <= paX + 170 && cy >= paY && cy <= paY + 44) {
          resetGame();
        }
      }
    },
    [resetGame],
  );

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="rounded-xl border border-card-border cursor-pointer"
        style={{ background: "#060610" }}
        tabIndex={0}
        onClick={handleCanvasClick}
      />
      {phase === "playing" && (
        <p className="text-xs text-muted font-mono tracking-widest uppercase">
          Arrow keys · WASD · Avoid red concepts · Ride logs · Dodge trains
        </p>
      )}
    </div>
  );
}
