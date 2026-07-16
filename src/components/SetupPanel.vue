<script setup lang="ts">
/**
 * SetupPanel — the adjuster stack (right column of the workbench).
 * Every write goes through store.updateSetup() immediately; derived
 * state is cheap so there is no debounce.
 */
import { computed, reactive, watch } from 'vue'
import { useSetupStore } from '../store/setups'
import { parseTire } from '../core/tire'
import type { Setup } from '../core/types'

const store = useSetupStore()
const s = computed(() => store.activeSetup)

// ---------------------------------------------------------------------------
// Generic numeric rows (slider + number, or number only)
// ---------------------------------------------------------------------------

type NumKey =
  | 'forkHeightMm'
  | 'rearRideHeightMm'
  | 'chainAdjusterMm'
  | 'frontSpringNmm'
  | 'rearSpringNmm'
  | 'frontPreloadMm'
  | 'rearPreloadMm'
  | 'frontSprocket'
  | 'rearSprocket'
  | 'riderKg'

interface NumRow {
  key: NumKey
  label: string
  step: number
  unit: string
  min?: number
  max?: number
  slider?: { min: number; max: number; step: number }
  hint?: string
}

type PanelId = 'setup' | 'front' | 'rear' | 'rolling' | 'drivetrain' | 'rider' | 'notes'

interface PanelDef {
  id: PanelId
  title: string
  rows: NumRow[]
}

const panels: PanelDef[] = [
  { id: 'setup', title: 'Setup', rows: [] },
  {
    id: 'front',
    title: 'Front End',
    rows: [
      {
        key: 'forkHeightMm',
        label: 'Fork height',
        step: 0.5,
        unit: 'mm',
        slider: { min: -5, max: 15, step: 0.5 },
        hint: '+ = tubes up = front lower',
      },
      { key: 'frontSpringNmm', label: 'Spring rate', step: 0.05, unit: 'N/mm', min: 0 },
      { key: 'frontPreloadMm', label: 'Preload', step: 0.5, unit: 'mm', min: 0 },
    ],
  },
  {
    id: 'rear',
    title: 'Rear End',
    rows: [
      {
        key: 'rearRideHeightMm',
        label: 'Ride height',
        step: 0.5,
        unit: 'mm',
        slider: { min: -10, max: 10, step: 0.5 },
        hint: '+ = raise',
      },
      { key: 'rearSpringNmm', label: 'Spring rate', step: 0.05, unit: 'N/mm', min: 0 },
      { key: 'rearPreloadMm', label: 'Preload', step: 0.5, unit: 'mm', min: 0 },
    ],
  },
  { id: 'rolling', title: 'Rolling Stock', rows: [] },
  {
    id: 'drivetrain',
    title: 'Drivetrain',
    rows: [
      {
        key: 'chainAdjusterMm',
        label: 'Adjuster',
        step: 0.5,
        unit: 'mm',
        slider: { min: -10, max: 10, step: 0.5 },
        hint: '+ = axle back',
      },
    ],
  },
  {
    id: 'rider',
    title: 'Rider',
    rows: [{ key: 'riderKg', label: 'Weight', step: 1, unit: 'kg', min: 40, max: 150 }],
  },
  { id: 'notes', title: 'Notes', rows: [] },
]

function numVal(key: NumKey): number {
  const cur = store.activeSetup
  return cur ? cur[key] : 0
}

function patchNum(row: NumRow, ev: Event) {
  const el = ev.target as HTMLInputElement
  const raw = el.value
  if (raw.trim() === '') return
  let v = Number(raw)
  if (!Number.isFinite(v)) return
  const min = row.slider ? row.slider.min : row.min
  const max = row.slider ? row.slider.max : row.max
  if (min !== undefined) v = Math.max(min, v)
  if (max !== undefined) v = Math.min(max, v)
  // keep the DOM honest when clamping lands on the value already in the store
  // (a same-value store write would not trigger a re-render)
  el.value = String(v)
  const patch: Partial<Setup> = {}
  patch[row.key] = v
  store.updateSetup(patch)
}

// ---------------------------------------------------------------------------
// SETUP group — name, copy, baseline
// ---------------------------------------------------------------------------

const isBaseline = computed(
  () => store.activeSetupId !== null && store.activeSetupId === store.baselineSetupId,
)

function onName(ev: Event) {
  store.updateSetup({ name: (ev.target as HTMLInputElement).value })
}

function saveCopy() {
  const cur = store.activeSetup
  if (!cur) return
  const name = window.prompt('Name for the copy:', `${cur.name} copy`)
  if (!name || !name.trim()) return
  store.newSetup(name.trim(), cur)
}

function toggleBaseline() {
  store.setBaseline(isBaseline.value ? null : store.activeSetupId)
}

// ---------------------------------------------------------------------------
// ROLLING STOCK — tire inputs with parseTire validation (no store write on bad)
// ---------------------------------------------------------------------------

type TireKey = 'frontTire' | 'rearTire'

const tireRows: { key: TireKey; label: string }[] = [
  { key: 'frontTire', label: 'Front tire' },
  { key: 'rearTire', label: 'Rear tire' },
]

const tireDraft = reactive<Record<TireKey, string>>({ frontTire: '', rearTire: '' })
const tireError = reactive<Record<TireKey, string | null>>({ frontTire: null, rearTire: null })

watch(
  () => [store.activeSetupId, store.activeSetup?.frontTire, store.activeSetup?.rearTire] as const,
  () => {
    tireDraft.frontTire = store.activeSetup?.frontTire ?? ''
    tireDraft.rearTire = store.activeSetup?.rearTire ?? ''
    tireError.frontTire = null
    tireError.rearTire = null
  },
  { immediate: true },
)

function onTire(key: TireKey, ev: Event) {
  const raw = (ev.target as HTMLInputElement).value.trim()
  tireDraft[key] = raw
  try {
    parseTire(raw)
    tireError[key] = null
    const patch: Partial<Setup> = {}
    patch[key] = raw
    store.updateSetup(patch)
  } catch (err) {
    tireError[key] = err instanceof Error ? err.message : 'unrecognised tire spec'
  }
}

// ---------------------------------------------------------------------------
// DRIVETRAIN — sprocket steppers + chain links
// ---------------------------------------------------------------------------

interface SprocketRow {
  key: 'frontSprocket' | 'rearSprocket'
  label: string
  min: number
  max: number
}

const sprocketRows: SprocketRow[] = [
  { key: 'frontSprocket', label: 'Front sprocket', min: 12, max: 20 },
  { key: 'rearSprocket', label: 'Rear sprocket', min: 38, max: 52 },
]

function stepSprocket(row: SprocketRow, delta: number) {
  const cur = store.activeSetup
  if (!cur) return
  const next = Math.min(row.max, Math.max(row.min, cur[row.key] + delta))
  if (next === cur[row.key]) return
  const patch: Partial<Setup> = {}
  patch[row.key] = next
  store.updateSetup(patch)
}

const chainAuto = computed(() => (store.activeSetup ? store.activeSetup.chainLinks === null : true))
const requiredLinks = computed(() => store.derived?.drivetrain.chainLinksRequired ?? null)
const manualLinks = computed(() => store.activeSetup?.chainLinks ?? requiredLinks.value ?? 110)

function onChainAuto(ev: Event) {
  const auto = (ev.target as HTMLInputElement).checked
  if (auto) {
    store.updateSetup({ chainLinks: null })
  } else {
    const seed = requiredLinks.value ?? 110
    store.updateSetup({ chainLinks: Math.min(130, Math.max(90, seed)) })
  }
}

function onChainLinks(ev: Event) {
  const el = ev.target as HTMLInputElement
  const raw = el.value
  if (raw.trim() === '') return
  const v = Number(raw)
  if (!Number.isFinite(v)) return
  // chains come in even link counts — snap, then clamp to the control range
  const links = Math.min(130, Math.max(90, Math.round(v / 2) * 2))
  el.value = String(links)
  store.updateSetup({ chainLinks: links })
}

// ---------------------------------------------------------------------------
// NOTES
// ---------------------------------------------------------------------------

function onNotes(ev: Event) {
  store.updateSetup({ notes: (ev.target as HTMLTextAreaElement).value })
}
</script>

<template>
  <div v-if="s" class="stack">
    <section v-for="p in panels" :key="p.id" class="panel">
      <h2 class="panel-title">{{ p.title }}</h2>
      <div class="panel-body">
        <!-- 1 · SETUP -->
        <template v-if="p.id === 'setup'">
          <div class="row">
            <label class="row-label" for="setup-name">Name</label>
            <input
              id="setup-name"
              type="text"
              class="grow"
              spellcheck="false"
              :value="s?.name ?? ''"
              @input="onName"
            />
          </div>
          <div class="btn-row">
            <button type="button" class="btn" @click="saveCopy">Save copy as…</button>
            <button
              type="button"
              class="btn"
              :class="{ baseline: isBaseline }"
              @click="toggleBaseline"
            >
              {{ isBaseline ? 'Baseline ✓' : 'Set as baseline' }}
            </button>
          </div>
        </template>

        <!-- 4 · ROLLING STOCK -->
        <template v-if="p.id === 'rolling'">
          <div v-for="t in tireRows" :key="t.key" class="row">
            <label class="row-label">{{ t.label }}</label>
            <input
              type="text"
              class="grow"
              spellcheck="false"
              placeholder="120/70ZR17"
              :class="{ invalid: tireError[t.key] !== null }"
              :value="tireDraft[t.key]"
              @change="onTire(t.key, $event)"
            />
            <p v-if="tireError[t.key]" class="error">{{ tireError[t.key] }}</p>
          </div>
        </template>

        <!-- 5 · DRIVETRAIN (steppers + chain, then generic adjuster row) -->
        <template v-if="p.id === 'drivetrain'">
          <div v-for="sp in sprocketRows" :key="sp.key" class="row">
            <label class="row-label">{{ sp.label }}</label>
            <div class="stepper">
              <button
                type="button"
                class="step-btn"
                :disabled="numVal(sp.key) <= sp.min"
                @click="stepSprocket(sp, -1)"
              >
                −
              </button>
              <span class="step-val mono">{{ numVal(sp.key) }}</span>
              <button
                type="button"
                class="step-btn"
                :disabled="numVal(sp.key) >= sp.max"
                @click="stepSprocket(sp, +1)"
              >
                +
              </button>
            </div>
            <span class="unit">T</span>
          </div>

          <div class="row">
            <label class="row-label">Chain</label>
            <label class="check">
              <input type="checkbox" :checked="chainAuto" @change="onChainAuto" />
              auto
            </label>
            <div class="row-value">
              <span v-if="chainAuto" class="auto-readout mono">{{ requiredLinks ?? '—' }}</span>
              <input
                v-else
                type="number"
                class="num"
                min="90"
                max="130"
                step="2"
                :value="manualLinks"
                @change="onChainLinks"
              />
              <span class="unit">links</span>
            </div>
            <p v-if="!chainAuto" class="hint">
              required: {{ requiredLinks ?? '—' }} links
            </p>
          </div>
        </template>

        <!-- 7 · NOTES -->
        <template v-if="p.id === 'notes'">
          <textarea
            class="notes"
            rows="4"
            spellcheck="false"
            placeholder="track, conditions, feel…"
            :value="s?.notes ?? ''"
            @input="onNotes"
          ></textarea>
        </template>

        <!-- Generic numeric rows (2 · FRONT, 3 · REAR, adjuster, 6 · RIDER) -->
        <div v-for="row in p.rows" :key="row.key" class="row">
          <label class="row-label">{{ row.label }}</label>
          <input
            v-if="row.slider"
            type="range"
            :min="row.slider.min"
            :max="row.slider.max"
            :step="row.slider.step"
            :value="numVal(row.key)"
            @input="patchNum(row, $event)"
          />
          <div class="row-value">
            <input
              type="number"
              class="num"
              :min="row.slider ? row.slider.min : row.min"
              :max="row.slider ? row.slider.max : row.max"
              :step="row.step"
              :value="numVal(row.key)"
              @change="patchNum(row, $event)"
            />
            <span class="unit">{{ row.unit }}</span>
          </div>
          <p v-if="row.hint" class="hint">{{ row.hint }}</p>
        </div>
      </div>
    </section>
  </div>

  <!-- quiet empty state: no bike / no setup yet -->
  <div v-else class="panel empty">
    <h2 class="panel-title">Setup</h2>
    <div class="empty-body mono">no active setup — select a bike to begin</div>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-body {
  padding: 10px var(--pad) 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* --- generic row: label | control | mono value + unit ------------------- */

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.row-label {
  flex: 0 0 92px;
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ink-dim);
}

.row input[type='range'] {
  flex: 1 1 60px;
  min-width: 50px;
  height: 20px;
  accent-color: var(--orange);
  cursor: ew-resize;
}

.row-value {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

input.num {
  width: 70px;
  text-align: right;
}

.grow {
  flex: 1 1 60px;
  min-width: 0;
}

.unit {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  color: var(--ink-faint);
  min-width: 28px;
}

.hint,
.error {
  flex-basis: 100%;
  margin: -2px 0 0 100px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.02em;
}

.hint {
  color: var(--ink-faint);
}

.error {
  color: var(--bad);
}

input.invalid,
input.invalid:focus {
  border-color: var(--bad);
}

/* --- SETUP buttons ------------------------------------------------------- */

.btn-row {
  display: flex;
  gap: 8px;
}

.btn {
  flex: 1;
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 7px 10px;
  background: transparent;
  border: 1px solid var(--line-strong);
  border-radius: var(--rad);
  color: var(--ink-dim);
}

.btn:hover {
  border-color: var(--orange);
  color: var(--orange);
}

.btn.baseline {
  border-color: var(--cyan);
  color: var(--cyan);
  background: var(--cyan-soft);
}

/* --- sprocket steppers ---------------------------------------------------- */

.stepper {
  margin-left: auto;
  display: flex;
  align-items: stretch;
  border: 1px solid var(--line-strong);
  border-radius: var(--rad);
  overflow: hidden;
}

.step-btn {
  width: 26px;
  height: 26px;
  background: var(--panel-raised);
  border: none;
  color: var(--orange);
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1;
  padding: 0;
}

.step-btn:hover:not(:disabled) {
  background: var(--orange-soft);
}

.step-btn:disabled {
  color: var(--ink-faint);
  cursor: default;
}

.step-val {
  width: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  border-left: 1px solid var(--line-strong);
  border-right: 1px solid var(--line-strong);
  background: var(--asphalt);
}

/* --- chain --------------------------------------------------------------- */

.check {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-dim);
  cursor: pointer;
}

.check input {
  accent-color: var(--orange);
  margin: 0;
}

.auto-readout {
  width: 70px;
  text-align: right;
  padding: 5px 8px;
  font-size: 13px;
  color: var(--ink);
  border: 1px dashed var(--line-strong);
  border-radius: var(--rad);
}

/* --- notes ---------------------------------------------------------------- */

.notes {
  width: 100%;
  min-height: 72px;
  resize: vertical;
  line-height: 1.5;
}

/* --- empty state ----------------------------------------------------------- */

.empty-body {
  padding: 28px var(--pad);
  font-size: 12px;
  color: var(--ink-faint);
  text-align: center;
  letter-spacing: 0.04em;
}

.mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
</style>
