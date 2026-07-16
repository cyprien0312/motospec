<script setup lang="ts">
/**
 * BlueprintView — live engineering side-elevation of the motorcycle.
 *
 * Pure projection of store.derived (current setup, orange/ink) with an
 * optional ghost overlay of store.baselineDerived (cyan, dashed, unlabeled).
 * All chassis math lives in src/core; this file only maps mm → px.
 *
 * Screen frame: SVG y grows DOWN. World frame (core): +x forward, +z up.
 * The bike points right, so worldX → svgX, worldZ → (GROUND_Y − z·s).
 */
import { computed } from 'vue'
import { useSetupStore } from '../store/setups'
import type { GeometryState } from '../core/types'

const store = useSetupStore()

// ── drawing constants (viewBox units) ───────────────────────────────────────
const VB_W = 1000
const VB_H = 580
const GROUND_Y = 470
const GROUND_X0 = 24
const GROUND_X1 = 976
const MARGIN_L = 70
const MARGIN_R = 78
/** stylized steering-head height above the front axle, along +z (mm) */
const HEAD_ABOVE_AXLE_MM = 500
/** rake dimension arc radius (px) */
const ARC_R = 46
/** wheelbase dimension line, below the ground */
const DIM_Y = GROUND_Y + 28
/** trail bracket height above the ground */
const TRAIL_Y = GROUND_Y - 12

/** ground hatching tick origins, every 24 px */
const HATCH_XS: number[] = []
for (let hx = GROUND_X0 + 10; hx <= GROUND_X1; hx += 24) HATCH_XS.push(hx)

// ── geometry helpers ─────────────────────────────────────────────────────────
interface Pt {
  x: number
  y: number
}

interface Figure {
  rearAxle: Pt
  frontAxle: Pt
  rearR: number
  frontR: number
  pivot: Pt
  axisGround: Pt
  axisTop: Pt
  head: Pt
  forkBot: Pt
  forkTop: Pt
}

interface Scene {
  fig: Figure
  ghost: Figure | null
  chassisTop: string
  chassisBottom: string
  trail: { x1: number; x2: number; label: string; labelX: number }
  wb: { x1: number; x2: number; midX: number; label: string }
  arc: { d: string; labelX: number; labelY: number; label: string }
  armLabel: { x: number; y: number; text: string }
  callout1: string
  callout2: string
  titleLines: [string, string, string]
}

function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180
}

/** round for tidy path/points strings */
function r1(n: number): number {
  return Math.round(n * 10) / 10
}

function pts(list: Pt[]): string {
  return list.map((p) => `${r1(p.x)},${r1(p.y)}`).join(' ')
}

/**
 * Project one GeometryState into screen space.
 * Both current and ghost figures share scale `s` and the rear contact patch
 * anchor `rearContactX`, so on-screen deltas are honest mm deltas.
 */
function buildFigure(
  g: GeometryState,
  swingarmLengthMm: number,
  s: number,
  rearContactX: number,
): Figure {
  const rearR = g.rearTireRadiusMm * s
  const frontR = g.frontTireRadiusMm * s
  const rearAxle: Pt = { x: rearContactX, y: GROUND_Y - rearR }
  const frontAxle: Pt = { x: rearContactX + g.wheelbaseMm * s, y: GROUND_Y - frontR }

  // Swingarm pivot, exactly as core defines it: P = axle + L·(cos a, sin a),
  // toward the front, ABOVE the axle when the angle is positive.
  const arm = deg2rad(g.swingarmAngleDeg)
  const pivot: Pt = {
    x: rearAxle.x + swingarmLengthMm * Math.cos(arm) * s,
    y: rearAxle.y - swingarmLengthMm * Math.sin(arm) * s,
  }

  // Steering axis: anchored at its ground intersection (contact patch + trail,
  // straight from core's trail formula) and tilted rake° from vertical. The
  // axle then sits forkOffset ahead of this line by construction.
  const rake = deg2rad(g.rakeDeg)
  const ux = -Math.sin(rake) // unit vector UP the axis, screen frame
  const uy = -Math.cos(rake)
  const axisGround: Pt = { x: frontAxle.x + g.trailMm * s, y: GROUND_Y }
  const tHead = ((g.frontTireRadiusMm + HEAD_ABOVE_AXLE_MM) * s) / Math.cos(rake)
  const head: Pt = { x: axisGround.x + tHead * ux, y: axisGround.y + tHead * uy }
  const axisTop: Pt = { x: axisGround.x + (tHead + 80) * ux, y: axisGround.y + (tHead + 80) * uy }

  // Fork lowers: parallel to the axis, through the axle.
  const forkLen = ((HEAD_ABOVE_AXLE_MM * s) / Math.cos(rake)) * 0.62
  const forkBot: Pt = { x: frontAxle.x - 12 * ux, y: frontAxle.y - 12 * uy }
  const forkTop: Pt = { x: frontAxle.x + forkLen * ux, y: frontAxle.y + forkLen * uy }

  return { rearAxle, frontAxle, rearR, frontR, pivot, axisGround, axisTop, head, forkBot, forkTop }
}

// ── scene ────────────────────────────────────────────────────────────────────
const ghostOn = computed<boolean>(
  () => store.baselineDerived !== null && store.baselineSetupId !== store.activeSetupId,
)

const sc = computed<Scene | null>(() => {
  const bike = store.activeBike
  const setup = store.activeSetup
  const derived = store.derived
  if (!bike || !setup || !derived) return null

  const g = derived.geometry
  const baseline = store.baselineDerived
  const ghostG =
    baseline && store.baselineSetupId !== store.activeSetupId ? baseline.geometry : null

  // Scale so wheelbase + both tires (of whichever figure is longer) fit.
  const extentOf = (gg: GeometryState): number =>
    gg.rearTireRadiusMm + gg.wheelbaseMm + gg.frontTireRadiusMm
  const extentMm = Math.max(extentOf(g), ghostG ? extentOf(ghostG) : 0)
  const s = (VB_W - MARGIN_L - MARGIN_R) / extentMm
  const maxRearRMm = Math.max(g.rearTireRadiusMm, ghostG ? ghostG.rearTireRadiusMm : 0)
  const rearContactX = MARGIN_L + maxRearRMm * s

  const fig = buildFigure(g, bike.swingarmLengthMm, s, rearContactX)
  const ghost = ghostG ? buildFigure(ghostG, bike.swingarmLengthMm, s, rearContactX) : null

  // Stylized chassis silhouette (pure aesthetics, anchored to real points).
  const wbPx = g.wheelbaseMm * s
  const head = fig.head
  const chassisTop = pts([
    head,
    { x: head.x - 0.16 * wbPx, y: head.y - 16 }, // tank hump
    { x: head.x - 0.42 * wbPx, y: head.y + 12 }, // seat
    { x: fig.rearAxle.x - 0.05 * wbPx, y: head.y - 8 }, // tail
  ])
  const engineLow: Pt = {
    x: fig.pivot.x + 0.45 * (head.x - fig.pivot.x),
    y: GROUND_Y - 150 * s,
  }
  const chassisBottom = pts([head, engineLow, fig.pivot])

  // Rake dimension arc: from vertical reference down to the steering axis.
  const rake = deg2rad(g.rakeDeg)
  const arcEnd: Pt = {
    x: head.x - ARC_R * Math.sin(rake),
    y: head.y - ARC_R * Math.cos(rake),
  }
  const arcD = `M ${r1(head.x)} ${r1(head.y - ARC_R)} A ${ARC_R} ${ARC_R} 0 0 0 ${r1(arcEnd.x)} ${r1(arcEnd.y)}`
  const midAng = -Math.PI / 2 - rake / 2
  const arcLabelX = head.x + (ARC_R + 20) * Math.cos(midAng)
  const arcLabelY = head.y + (ARC_R + 20) * Math.sin(midAng) + 4

  // Title block, second line truncated so it stays inside the border.
  let combo = `${bike.name} — ${setup.name}`.toUpperCase()
  if (combo.length > 40) combo = `${combo.slice(0, 39)}…`

  return {
    fig,
    ghost,
    chassisTop,
    chassisBottom,
    trail: {
      x1: fig.frontAxle.x,
      x2: fig.axisGround.x,
      label: `TRAIL ${g.trailMm.toFixed(1)} mm`,
      labelX: Math.max(fig.frontAxle.x, fig.axisGround.x) + 8,
    },
    wb: {
      x1: fig.rearAxle.x,
      x2: fig.frontAxle.x,
      midX: (fig.rearAxle.x + fig.frontAxle.x) / 2,
      label: `${Math.round(g.wheelbaseMm)} mm`,
    },
    arc: { d: arcD, labelX: arcLabelX, labelY: arcLabelY, label: `${g.rakeDeg.toFixed(1)}°` },
    armLabel: {
      x: fig.pivot.x + 10,
      y: fig.pivot.y + 18,
      text: `${g.swingarmAngleDeg.toFixed(1)}°`,
    },
    callout1: `ANTI-SQUAT ${derived.balance.antiSquatPct.toFixed(0)}%`,
    callout2: `F ${derived.balance.weightFrontPct.toFixed(1)}% / R ${derived.balance.weightRearPct.toFixed(1)}%`,
    titleLines: ['MOTOSPEC', combo, 'STATIC GEOMETRY · SHEET 01'],
  }
})
</script>

<template>
  <div class="panel blueprint">
    <div class="panel-title">
      Blueprint · Side Elevation
      <span v-if="ghostOn" class="ghost-flag">◌ baseline ghost</span>
    </div>

    <div v-if="sc" class="canvas">
      <svg
        :viewBox="`0 0 ${VB_W} ${VB_H}`"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Motorcycle side elevation, static geometry"
      >
        <defs>
          <marker
            id="bpv-dim-arrow"
            viewBox="0 0 10 8"
            refX="10"
            refY="4"
            markerWidth="10"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 4 L0 8 Z" fill="var(--bp-dim)" />
          </marker>
        </defs>

        <!-- ── ground ──────────────────────────────────────────────────── -->
        <line class="ground" :x1="GROUND_X0" :y1="GROUND_Y" :x2="GROUND_X1" :y2="GROUND_Y" />
        <line
          v-for="hx in HATCH_XS"
          :key="hx"
          class="hatch"
          :x1="hx"
          :y1="GROUND_Y + 1"
          :x2="hx - 9"
          :y2="GROUND_Y + 10"
        />

        <!-- ── ghost baseline (under the current layer, no labels) ─────── -->
        <g v-if="sc.ghost" class="ghost">
          <circle class="ghost-tire" :cx="sc.ghost.rearAxle.x" :cy="sc.ghost.rearAxle.y" :r="sc.ghost.rearR" />
          <circle class="ghost-tire" :cx="sc.ghost.frontAxle.x" :cy="sc.ghost.frontAxle.y" :r="sc.ghost.frontR" />
          <line
            class="ghost-arm"
            :x1="sc.ghost.pivot.x"
            :y1="sc.ghost.pivot.y"
            :x2="sc.ghost.rearAxle.x"
            :y2="sc.ghost.rearAxle.y"
          />
          <line
            class="ghost-axis"
            :x1="sc.ghost.axisGround.x"
            :y1="sc.ghost.axisGround.y"
            :x2="sc.ghost.axisTop.x"
            :y2="sc.ghost.axisTop.y"
          />
          <circle class="ghost-dot" :cx="sc.ghost.rearAxle.x" :cy="sc.ghost.rearAxle.y" r="2.5" />
          <circle class="ghost-dot" :cx="sc.ghost.frontAxle.x" :cy="sc.ghost.frontAxle.y" r="2.5" />
          <circle class="ghost-dot" :cx="sc.ghost.pivot.x" :cy="sc.ghost.pivot.y" r="3" />
        </g>

        <!-- ── stylized chassis (construction lines) ───────────────────── -->
        <polyline class="construction" :points="sc.chassisTop" />
        <polyline class="construction" :points="sc.chassisBottom" />

        <!-- ── wheels ──────────────────────────────────────────────────── -->
        <circle class="tire" :cx="sc.fig.rearAxle.x" :cy="sc.fig.rearAxle.y" :r="sc.fig.rearR" />
        <circle class="rim" :cx="sc.fig.rearAxle.x" :cy="sc.fig.rearAxle.y" :r="sc.fig.rearR * 0.55" />
        <circle class="tire" :cx="sc.fig.frontAxle.x" :cy="sc.fig.frontAxle.y" :r="sc.fig.frontR" />
        <circle class="rim" :cx="sc.fig.frontAxle.x" :cy="sc.fig.frontAxle.y" :r="sc.fig.frontR * 0.55" />

        <!-- ── fork lowers ─────────────────────────────────────────────── -->
        <line
          class="fork"
          :x1="sc.fig.forkBot.x"
          :y1="sc.fig.forkBot.y"
          :x2="sc.fig.forkTop.x"
          :y2="sc.fig.forkTop.y"
        />

        <!-- ── steering axis ───────────────────────────────────────────── -->
        <line
          class="axis"
          :x1="sc.fig.axisGround.x"
          :y1="sc.fig.axisGround.y"
          :x2="sc.fig.axisTop.x"
          :y2="sc.fig.axisTop.y"
        />

        <!-- ── swingarm ────────────────────────────────────────────────── -->
        <line
          class="arm"
          :x1="sc.fig.pivot.x"
          :y1="sc.fig.pivot.y"
          :x2="sc.fig.rearAxle.x"
          :y2="sc.fig.rearAxle.y"
        />
        <circle class="pivot-dot" :cx="sc.fig.pivot.x" :cy="sc.fig.pivot.y" r="4" />
        <text class="dim-text" :x="sc.armLabel.x" :y="sc.armLabel.y">{{ sc.armLabel.text }}</text>

        <!-- axle dots over everything wheel-related -->
        <circle class="axle-dot" :cx="sc.fig.rearAxle.x" :cy="sc.fig.rearAxle.y" r="3" />
        <circle class="axle-dot" :cx="sc.fig.frontAxle.x" :cy="sc.fig.frontAxle.y" r="3" />

        <!-- ── rake arc at the steering head ───────────────────────────── -->
        <line
          class="construction dashed"
          :x1="sc.fig.head.x"
          :y1="sc.fig.head.y"
          :x2="sc.fig.head.x"
          :y2="sc.fig.head.y - 64"
        />
        <path class="dim-line" :d="sc.arc.d" fill="none" />
        <text class="dim-text" :x="sc.arc.labelX" :y="sc.arc.labelY" text-anchor="middle">
          {{ sc.arc.label }}
        </text>

        <!-- ── trail callout (bracket on the ground) ───────────────────── -->
        <line class="dim-line" :x1="sc.trail.x1" :y1="GROUND_Y - 2" :x2="sc.trail.x1" :y2="TRAIL_Y" />
        <line class="dim-line" :x1="sc.trail.x2" :y1="GROUND_Y - 2" :x2="sc.trail.x2" :y2="TRAIL_Y" />
        <line class="dim-line" :x1="sc.trail.x1" :y1="TRAIL_Y" :x2="sc.trail.x2" :y2="TRAIL_Y" />
        <text class="dim-text" :x="sc.trail.labelX" :y="GROUND_Y - 8">{{ sc.trail.label }}</text>

        <!-- ── wheelbase dimension (below the ground) ──────────────────── -->
        <line class="dim-line" :x1="sc.wb.x1" :y1="GROUND_Y + 3" :x2="sc.wb.x1" :y2="DIM_Y + 6" />
        <line class="dim-line" :x1="sc.wb.x2" :y1="GROUND_Y + 3" :x2="sc.wb.x2" :y2="DIM_Y + 6" />
        <line
          class="dim-line"
          :x1="sc.wb.x1"
          :y1="DIM_Y"
          :x2="sc.wb.x2"
          :y2="DIM_Y"
          marker-start="url(#bpv-dim-arrow)"
          marker-end="url(#bpv-dim-arrow)"
        />
        <text class="dim-text" :x="sc.wb.midX" :y="DIM_Y - 6" text-anchor="middle">
          {{ sc.wb.label }}
        </text>

        <!-- ── top-right callouts ──────────────────────────────────────── -->
        <text class="dim-text" :x="GROUND_X1" y="26" text-anchor="end">{{ sc.callout1 }}</text>
        <text class="dim-text" :x="GROUND_X1" y="44" text-anchor="end">{{ sc.callout2 }}</text>

        <!-- ── title block ─────────────────────────────────────────────── -->
        <g>
          <rect class="tb-rect" x="688" y="512" width="300" height="60" />
          <line class="tb-line" x1="688" y1="532" x2="988" y2="532" />
          <line class="tb-line" x1="688" y1="552" x2="988" y2="552" />
          <text class="tb-text tb-brand" x="698" y="526">{{ sc.titleLines[0] }}</text>
          <text class="tb-text" x="698" y="546">{{ sc.titleLines[1] }}</text>
          <text class="tb-text" x="698" y="566">{{ sc.titleLines[2] }}</text>
        </g>
      </svg>
    </div>

    <div v-else class="empty">Select a bike</div>
  </div>
</template>

<style scoped>
.blueprint {
  flex: 1;
  min-height: 320px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ghost-flag {
  margin-left: auto;
  color: var(--cyan);
  font-size: 11px;
  letter-spacing: 0.14em;
}

/* drafting-table grid: minor every 20 px, major every 100 px */
.canvas {
  flex: 1;
  min-height: 0;
  background-image:
    repeating-linear-gradient(90deg, var(--bp-grid-major) 0 1px, transparent 1px 100px),
    repeating-linear-gradient(0deg, var(--bp-grid-major) 0 1px, transparent 1px 100px),
    repeating-linear-gradient(90deg, var(--bp-grid) 0 1px, transparent 1px 20px),
    repeating-linear-gradient(0deg, var(--bp-grid) 0 1px, transparent 1px 20px);
}

.canvas svg {
  display: block;
  width: 100%;
  height: 100%;
}

.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink-faint);
  font-family: var(--font-display);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.25em;
}

/* ── environment ── */
.ground {
  stroke: var(--ink);
  stroke-width: 3;
  stroke-linecap: square;
}
.hatch {
  stroke: var(--ink-dim);
  stroke-width: 1;
  opacity: 0.7;
}

/* ── current setup ── */
.tire {
  stroke: var(--ink);
  stroke-width: 2;
  fill: none;
}
.rim {
  stroke: var(--bp-construction);
  stroke-width: 1;
  fill: none;
}
.axle-dot {
  fill: var(--ink);
}
.arm {
  stroke: var(--orange);
  stroke-width: 3;
  stroke-linecap: round;
}
.pivot-dot {
  fill: var(--orange);
}
.axis {
  stroke: var(--orange);
  stroke-width: 1.5;
  stroke-dasharray: 7 5;
}
.fork {
  stroke: var(--ink-dim);
  stroke-width: 2;
  stroke-linecap: round;
}

/* ── construction + dimensions ── */
.construction {
  stroke: var(--bp-construction);
  stroke-width: 1;
  fill: none;
  stroke-linejoin: round;
}
.construction.dashed {
  stroke-dasharray: 3 3;
}
.dim-line {
  stroke: var(--bp-dim);
  stroke-width: 1;
}
.dim-text {
  font-family: var(--font-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  fill: var(--bp-dim);
}

/* ── title block ── */
.tb-rect {
  stroke: var(--bp-construction);
  stroke-width: 1;
  fill: var(--panel);
}
.tb-line {
  stroke: var(--bp-construction);
  stroke-width: 1;
}
.tb-text {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  fill: var(--bp-dim);
}
.tb-brand {
  letter-spacing: 0.3em;
}

/* ── ghost baseline ── */
.ghost {
  opacity: 0.55;
}
.ghost-tire {
  stroke: var(--cyan);
  stroke-width: 1.5;
  stroke-dasharray: 6 5;
  fill: none;
}
.ghost-arm {
  stroke: var(--cyan);
  stroke-width: 2;
  stroke-dasharray: 6 5;
  stroke-linecap: round;
}
.ghost-axis {
  stroke: var(--cyan);
  stroke-width: 1;
  stroke-dasharray: 6 5;
}
.ghost-dot {
  fill: var(--cyan);
}
</style>
