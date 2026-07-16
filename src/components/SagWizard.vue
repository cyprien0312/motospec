<script setup lang="ts">
/**
 * SagWizard — guided static sag measurement (L1/L2/L3) for both ends.
 * Local input state, live analysis via core/suspension.analyzeSag, explicit
 * "apply" writes to the active setup through the store.
 */
import { computed, reactive, watch } from 'vue'
import { useSetupStore } from '../store/setups'
import { analyzeSag } from '../core/suspension'
import type { SagAnalysis, SagMeasurement, SagVerdict } from '../core/types'

const store = useSetupStore()

type EndKey = 'front' | 'rear'
type FieldKey = 'l1' | 'l2' | 'l3'

interface EndFields {
  l1: number | null
  l2: number | null
  l3: number | null
}

const front = reactive<EndFields>({ l1: null, l2: null, l3: null })
const rear = reactive<EndFields>({ l1: null, l2: null, l3: null })

const FIELDS: ReadonlyArray<{ key: FieldKey; label: string; hint: string }> = [
  { key: 'l1', label: 'L1', hint: 'topped out — on stand' },
  { key: 'l2', label: 'L2', hint: 'under own weight' },
  { key: 'l3', label: 'L3', hint: 'rider aboard' },
]

function syncFields(target: EndFields, m: SagMeasurement | undefined): void {
  target.l1 = m?.l1 ?? null
  target.l2 = m?.l2 ?? null
  target.l3 = m?.l3 ?? null
}

// Re-seed local inputs whenever the active setup changes (not on every patch
// of the SAME setup — the id is unchanged, so typing is never clobbered).
watch(
  () => store.activeSetupId,
  () => {
    syncFields(front, store.activeSetup?.frontSag)
    syncFields(rear, store.activeSetup?.rearSag)
  },
  { immediate: true },
)

function toMeas(f: EndFields): SagMeasurement | undefined {
  return f.l1 !== null && f.l2 !== null && f.l3 !== null
    ? { l1: f.l1, l2: f.l2, l3: f.l3 }
    : undefined
}

function complete(f: EndFields): boolean {
  return f.l1 !== null && f.l2 !== null && f.l3 !== null
}

const ready = computed(() => store.activeBike !== null && store.activeSetup !== null)

interface EndCfg {
  key: EndKey
  title: string
  fields: EndFields
  travelMm: number
  currentSpring: number
  analysis: SagAnalysis
}

const ends = computed<EndCfg[]>(() => {
  const bike = store.activeBike
  const setup = store.activeSetup
  if (!bike || !setup) return []
  return [
    {
      key: 'front',
      title: 'Front · Fork',
      fields: front,
      travelMm: bike.frontWheelTravelMm,
      currentSpring: setup.frontSpringNmm,
      analysis: analyzeSag(toMeas(front), bike.frontWheelTravelMm, 'front', setup.frontSpringNmm),
    },
    {
      key: 'rear',
      title: 'Rear · Shock',
      fields: rear,
      travelMm: bike.rearWheelTravelMm,
      currentSpring: setup.rearSpringNmm,
      analysis: analyzeSag(toMeas(rear), bike.rearWheelTravelMm, 'rear', setup.rearSpringNmm),
    },
  ]
})

function setField(f: EndFields, key: FieldKey, e: Event): void {
  const raw = (e.target as HTMLInputElement).value
  if (raw.trim() === '') {
    f[key] = null
    return
  }
  const n = Number(raw)
  f[key] = Number.isFinite(n) ? n : null
}

function applyEnd(key: EndKey): void {
  const m = toMeas(key === 'front' ? front : rear)
  if (!m) return
  store.updateSetup(key === 'front' ? { frontSag: m } : { rearSag: m })
}

function adoptRate(key: EndKey): void {
  const cfg = ends.value.find((e) => e.key === key)
  const suggested = cfg?.analysis.suggestedSpringNmm
  if (suggested === null || suggested === undefined) return
  store.updateSetup(key === 'front' ? { frontSpringNmm: suggested } : { rearSpringNmm: suggested })
}

/** True when the local fields match what is already stored on the setup. */
function isSaved(key: EndKey): boolean {
  const s = store.activeSetup
  if (!s) return false
  const stored = key === 'front' ? s.frontSag : s.rearSag
  const f = key === 'front' ? front : rear
  return stored !== undefined && stored.l1 === f.l1 && stored.l2 === f.l2 && stored.l3 === f.l3
}

function fmt(n: number | null): string {
  if (n === null) return '—'
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function band(b: [number, number]): string {
  return `${b[0]}–${b[1]} mm`
}

function verdictClass(v: SagVerdict): string {
  if (v === 'ok') return 'v-ok'
  if (v === 'n/a') return 'v-na'
  return 'v-warn'
}

function verdictLabel(v: SagVerdict): string {
  return v.replace('-', ' ')
}
</script>

<template>
  <div class="wizard">
    <template v-if="ready">
      <!-- ── intro ─────────────────────────────────────────────────────── -->
      <section class="panel">
        <div class="panel-title">Static sag — how to measure</div>
        <div class="body">
          <p>
            Sag is how far the suspension settles from fully extended under load. Set it right and the
            chassis sits at the intended ride height with the suspension in the working part of its stroke.
          </p>
          <ul class="meas-list">
            <li>
              <span class="meas-key mono">L1</span>
              <span>wheel topped out — bike on a stand, suspension fully extended</span>
            </li>
            <li>
              <span class="meas-key mono">L2</span>
              <span>bike settled under its own weight — off the stand, no rider</span>
            </li>
            <li>
              <span class="meas-key mono">L3</span>
              <span>rider aboard in riding position — full kit, feet on the pegs</span>
            </li>
          </ul>
          <p class="note">Measure axle → fixed point on the chassis. Same two points, every time.</p>
        </div>
      </section>

      <!-- ── one panel per end ─────────────────────────────────────────── -->
      <section v-for="end in ends" :key="end.key" class="panel">
        <div class="panel-title">
          {{ end.title }}
          <span class="title-meta mono">travel {{ end.travelMm }} mm</span>
        </div>

        <div class="end-body">
          <!-- pictogram -->
          <svg v-if="end.key === 'front'" class="picto" viewBox="0 0 140 90" aria-hidden="true">
            <line x1="8" y1="82" x2="132" y2="82" class="c" stroke-dasharray="5 4" />
            <!-- top clamp -->
            <line x1="50" y1="13" x2="78" y2="13" class="c" />
            <!-- stanchions -->
            <line x1="56" y1="6" x2="76" y2="74" class="c c2" />
            <line x1="68" y1="6" x2="88" y2="74" class="c c2" />
            <!-- axle -->
            <circle cx="82" cy="74" r="4" class="axle" />
            <!-- measurement arrow -->
            <line x1="108" y1="12" x2="108" y2="74" class="arrow" />
            <path d="M104 19 108 12 112 19" class="arrow" />
            <path d="M104 67 108 74 112 67" class="arrow" />
            <text x="116" y="47" class="lbl">L</text>
          </svg>

          <svg v-else class="picto" viewBox="0 0 140 90" aria-hidden="true">
            <line x1="8" y1="82" x2="132" y2="82" class="c" stroke-dasharray="5 4" />
            <!-- swingarm: pivot → axle -->
            <line x1="24" y1="46" x2="106" y2="60" class="c c2" />
            <circle cx="24" cy="46" r="3" class="c-fill" />
            <circle cx="106" cy="60" r="4" class="axle" />
            <!-- shock body + coil hint -->
            <line x1="56" y1="8" x2="66" y2="46" class="c c2" />
            <line x1="50" y1="18" x2="64" y2="14" class="c" />
            <line x1="52" y1="26" x2="66" y2="22" class="c" />
            <line x1="55" y1="34" x2="69" y2="30" class="c" />
            <!-- linkage hint -->
            <polyline points="66,46 58,58 40,52" class="c" />
            <!-- measurement arrow -->
            <line x1="122" y1="16" x2="122" y2="60" class="arrow" />
            <path d="M118 23 122 16 126 23" class="arrow" />
            <path d="M118 53 122 60 126 53" class="arrow" />
            <text x="130" y="42" class="lbl">L</text>
          </svg>

          <!-- inputs -->
          <div class="inputs">
            <label v-for="fld in FIELDS" :key="fld.key" class="field">
              <span class="f-label">{{ fld.label }}</span>
              <span class="f-row">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  inputmode="decimal"
                  :value="end.fields[fld.key] ?? ''"
                  @input="setField(end.fields, fld.key, $event)"
                />
                <span class="f-unit mono">mm</span>
              </span>
              <span class="f-hint">{{ fld.hint }}</span>
            </label>
          </div>

          <!-- live results -->
          <div class="results">
            <div class="metric">
              <div class="metric-label">Free sag</div>
              <div class="metric-row">
                <span class="metric-value mono">{{ fmt(end.analysis.freeSagMm) }}</span>
                <span class="metric-unit mono">mm</span>
                <span class="band mono">{{ band(end.analysis.targetFreeSagMm) }}</span>
              </div>
              <span class="badge" :class="verdictClass(end.analysis.springVerdict)">
                {{ verdictLabel(end.analysis.springVerdict) }}
              </span>
            </div>

            <div class="metric">
              <div class="metric-label">Rider sag</div>
              <div class="metric-row">
                <span class="metric-value mono">{{ fmt(end.analysis.riderSagMm) }}</span>
                <span class="metric-unit mono">mm</span>
                <span class="band mono">{{ band(end.analysis.targetRiderSagMm) }}</span>
              </div>
              <span class="badge" :class="verdictClass(end.analysis.riderSagVerdict)">
                {{ verdictLabel(end.analysis.riderSagVerdict) }}
              </span>
              <span v-if="end.analysis.riderSagPctOfTravel !== null" class="pct mono">
                {{ end.analysis.riderSagPctOfTravel.toFixed(0) }}% of travel
              </span>
            </div>
          </div>

          <!-- spring suggestion -->
          <div v-if="end.analysis.suggestedSpringNmm !== null" class="spring-row">
            <span class="spring-text mono">
              suggested ≈ {{ end.analysis.suggestedSpringNmm.toFixed(2) }} N/mm
              (current {{ end.currentSpring.toFixed(2) }})
            </span>
            <button
              class="btn ghost"
              :disabled="end.analysis.suggestedSpringNmm === end.currentSpring"
              @click="adoptRate(end.key)"
            >
              Adopt rate
            </button>
          </div>

          <!-- apply -->
          <div class="actions">
            <button
              class="btn primary"
              :disabled="!complete(end.fields) || isSaved(end.key)"
              :title="complete(end.fields) ? '' : 'Enter all three measurements first'"
              @click="applyEnd(end.key)"
            >
              Apply measurements to setup
            </button>
            <span v-if="isSaved(end.key)" class="saved mono">saved ✓</span>
          </div>
        </div>
      </section>

      <!-- ── footnote ──────────────────────────────────────────────────── -->
      <section class="panel">
        <div class="panel-title">Rule of thumb — free sag</div>
        <div class="body footnote">
          <p>
            <span class="badge v-warn">too soft</span>
            Free sag below the band: a soft spring needed heavy preload to fake the right rider sag — the bike rides topped out.
          </p>
          <p>
            <span class="badge v-warn">too stiff</span>
            Free sag above the band: a stiff spring needs almost no preload — it barely settles under the bike alone.
          </p>
        </div>
      </section>
    </template>

    <!-- ── quiet empty state ──────────────────────────────────────────── -->
    <section v-else class="panel empty">
      <p class="empty-title">No bike on the bench</p>
      <p class="empty-sub">Select a bike and setup to start measuring sag.</p>
    </section>
  </div>
</template>

<style scoped>
.wizard {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--gap);
}

.body {
  padding: var(--pad);
}

.body p {
  margin: 0 0 10px;
  color: var(--ink-dim);
}

/* intro */
.meas-list {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.meas-list li {
  display: flex;
  align-items: baseline;
  gap: 10px;
  color: var(--ink);
}

.meas-key {
  flex: 0 0 auto;
  color: var(--orange);
  border: 1px solid var(--line-strong);
  border-radius: var(--rad);
  padding: 1px 7px;
  font-size: 12px;
}

.note {
  margin: 0;
  padding: 6px 10px;
  border-left: 2px solid var(--bp-construction);
  color: var(--bp-dim);
  font-size: 13px;
}

/* per-end panel */
.title-meta {
  margin-left: auto;
  font-size: 11px;
  color: var(--ink-faint);
  letter-spacing: 0;
  text-transform: none;
}

.end-body {
  display: grid;
  grid-template-columns: 150px 220px 1fr;
  gap: var(--pad);
  padding: var(--pad);
  align-items: start;
}

.picto {
  width: 140px;
  height: 90px;
  flex: 0 0 auto;
}

.picto .c {
  stroke: var(--bp-construction);
  stroke-width: 1.5;
  fill: none;
}

.picto .c2 {
  stroke-width: 2;
}

.picto .c-fill {
  fill: var(--bp-construction);
}

.picto .axle {
  fill: var(--bp-dim);
}

.picto .arrow {
  stroke: var(--orange);
  stroke-width: 1.5;
  fill: none;
}

.picto .lbl {
  fill: var(--orange);
  font-family: var(--font-mono);
  font-size: 11px;
}

/* inputs */
.inputs {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field {
  display: grid;
  grid-template-columns: 30px 1fr;
  column-gap: 8px;
  row-gap: 2px;
  align-items: center;
}

.f-label {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-dim);
}

.f-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.f-row input {
  width: 90px;
  text-align: right;
}

.f-unit {
  font-size: 12px;
  color: var(--ink-faint);
}

.f-hint {
  grid-column: 2;
  font-size: 11px;
  color: var(--ink-faint);
}

/* results */
.results {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.metric-label {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--ink-dim);
  margin-bottom: 2px;
}

.metric-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.metric-value {
  font-size: 28px;
  font-weight: 500;
  color: var(--ink);
  line-height: 1.1;
}

.metric-unit {
  font-size: 13px;
  color: var(--ink-dim);
}

.band {
  font-size: 12px;
  color: var(--bp-dim);
  margin-left: 8px;
}

.band::before {
  content: 'target ';
  color: var(--ink-faint);
}

.badge {
  display: inline-block;
  margin-top: 4px;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border: 1px solid;
  border-radius: var(--rad);
  padding: 1px 8px;
}

.v-ok {
  color: var(--ok);
  border-color: var(--ok);
}

.v-warn {
  color: var(--warn);
  border-color: var(--warn);
}

.v-na {
  color: var(--ink-faint);
  border-color: var(--line-strong);
}

.pct {
  display: block;
  margin-top: 3px;
  font-size: 11px;
  color: var(--ink-faint);
}

/* spring suggestion + actions */
.spring-row,
.actions {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.spring-row {
  border-top: 1px solid var(--line);
  padding-top: 10px;
}

.spring-text {
  font-size: 13px;
  color: var(--ink);
}

.btn {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border-radius: var(--rad);
  padding: 6px 14px;
  background: transparent;
}

.btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.btn.primary {
  color: var(--orange);
  border: 1px solid var(--orange);
  background: var(--orange-soft);
}

.btn.primary:hover:not(:disabled) {
  background: var(--orange);
  color: var(--asphalt);
}

.btn.ghost {
  color: var(--ink-dim);
  border: 1px solid var(--line-strong);
}

.btn.ghost:hover:not(:disabled) {
  color: var(--ink);
  border-color: var(--ink-dim);
}

.saved {
  font-size: 12px;
  color: var(--ok);
}

/* footnote */
.footnote p {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 0 0 8px;
}

.footnote p:last-child {
  margin-bottom: 0;
}

.footnote .badge {
  flex: 0 0 auto;
  margin-top: 0;
}

/* empty state */
.empty {
  padding: 56px var(--pad);
  text-align: center;
}

.empty-title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 16px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--ink-dim);
  margin: 0 0 6px;
}

.empty-sub {
  color: var(--ink-faint);
  margin: 0;
  font-size: 13px;
}

@media (max-width: 640px) {
  .end-body {
    grid-template-columns: 1fr;
  }
}
</style>
