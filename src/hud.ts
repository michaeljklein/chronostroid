import type p5 from "p5";
import CONSTANTS from "./constants.json";

const { CANVAS, HP } = CONSTANTS;

export type HudPlayerData = {
  hp: number;
  energyFraction: number;
  zoneTick: number;
  presentTick: number;
};

// Team colors: P1 = blue, P2 = red (inline render-style literals)
const P1_COLOR: [number, number, number] = [0, 100, 255];
const P1_DEPLETED: [number, number, number] = [0, 30, 76];
const P2_COLOR: [number, number, number] = [255, 60, 60];
const P2_DEPLETED: [number, number, number] = [76, 18, 18];

/** Pure helper: returns null when zoneTick === presentTick. */
export function clockLabel(presentTick: number, zoneTick: number): string | null {
  if (zoneTick === presentTick) return null;
  const seconds = ((presentTick - zoneTick) / 60).toFixed(1);
  return `−${seconds}s`;
}

/** Pure helper: clamps hp to [0, HP.INITIAL] and returns segment counts. */
export function hpSegments(hp: number): { filled: number; depleted: number } {
  const filled = Math.max(0, Math.min(hp, HP.INITIAL));
  const depleted = HP.INITIAL - filled;
  return { filled, depleted };
}

function drawHpBar(
  p: p5,
  x: number,
  y: number,
  width: number,
  hp: number,
  color: [number, number, number],
  depletedColor: [number, number, number],
): void {
  const { filled, depleted } = hpSegments(hp);
  const total = filled + depleted;
  const segW = Math.floor(width / total);
  const gap = 1;

  p.noStroke();
  for (let i = 0; i < total; i++) {
    const segX = x + i * segW;
    if (i < filled) {
      p.fill(color[0], color[1], color[2]);
    } else {
      p.fill(depletedColor[0], depletedColor[1], depletedColor[2]);
    }
    p.rect(segX, y, segW - gap, CANVAS.HUD_BAR_HEIGHT);
  }
}

function drawEnergyBar(
  p: p5,
  x: number,
  y: number,
  width: number,
  fraction: number,
  color: [number, number, number],
): void {
  p.noStroke();
  // Background (depleted)
  p.fill(color[0] * 0.3, color[1] * 0.3, color[2] * 0.3);
  p.rect(x, y, width, CANVAS.HUD_BAR_HEIGHT);
  // Filled portion
  p.fill(color[0], color[1], color[2]);
  p.rect(x, y, Math.round(width * fraction), CANVAS.HUD_BAR_HEIGHT);
}

function drawClockLabel(
  p: p5,
  label: string,
  x: number,
  y: number,
  alignRight: boolean,
): void {
  p.fill(255);
  p.noStroke();
  p.textFont("monospace");
  p.textStyle(p.NORMAL);
  p.textSize(CANVAS.HUD_FONT_SIZE);
  if (alignRight) {
    p.textAlign(p.RIGHT, p.TOP);
  } else {
    p.textAlign(p.LEFT, p.TOP);
  }
  p.text(label, x, y);
}

export function drawHud(p: p5, p1: HudPlayerData, p2: HudPlayerData): void {
  const p1Width = CANVAS.HUD_P1_END_X;             // 0..160
  const p2Start = CANVAS.HUD_P2_START_X;           // 176
  const p2Width = CANVAS.WIDTH - p2Start;          // 160

  const row1Y = 0;
  const row2Y = CANVAS.HUD_BAR_HEIGHT + CANVAS.HUD_ROW_GAP;

  // --- P1 HP bar (row 1) ---
  drawHpBar(p, 0, row1Y, p1Width, p1.hp, P1_COLOR, P1_DEPLETED);

  // --- P2 HP bar (row 1) ---
  drawHpBar(p, p2Start, row1Y, p2Width, p2.hp, P2_COLOR, P2_DEPLETED);

  // --- P1 energy bar + clock label (row 2) ---
  const p1Label = clockLabel(p1.presentTick, p1.zoneTick);
  if (p1Label !== null) {
    // Energy bar takes left half; clock label on the right
    const halfW = Math.floor(p1Width / 2);
    drawEnergyBar(p, 0, row2Y, halfW, p1.energyFraction, P1_COLOR);
    drawClockLabel(p, p1Label, p1Width, row2Y, true);
  } else {
    drawEnergyBar(p, 0, row2Y, p1Width, p1.energyFraction, P1_COLOR);
  }

  // --- P2 energy bar + clock label (row 2) ---
  const p2Label = clockLabel(p2.presentTick, p2.zoneTick);
  if (p2Label !== null) {
    // Clock label on the left; energy bar takes right half
    const halfW = Math.floor(p2Width / 2);
    const energyX = p2Start + halfW;
    drawClockLabel(p, p2Label, p2Start, row2Y, false);
    drawEnergyBar(p, energyX, row2Y, halfW, p2.energyFraction, P2_COLOR);
  } else {
    drawEnergyBar(p, p2Start, row2Y, p2Width, p2.energyFraction, P2_COLOR);
  }
}
