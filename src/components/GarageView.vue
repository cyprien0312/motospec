<script setup lang="ts">
/**
 * GarageView — saved setups manager + comparator.
 * Cards for every setup of the active bike, A/B compare table,
 * JSON import/export. Consumes ONLY the setups store + core deriveState.
 */
import { computed, ref } from 'vue'
import { useSetupStore } from '../store/setups'
import { deriveState } from '../core/derive'
import type { DerivedState, SagMeasurement, Setup } from '../core/types'

const store = useSetupStore()

// ---------------------------------------------------------------------------
// formatting helpers
// ---------------------------------------------------------------------------

/** number → trimmed string ("2.50" → "2.5", "120.00" → "120") */
function fmtNum(v: number, dp = 1): string {
  return String(parseFloat(v.toFixed(dp)))
}

/** signed mm-style value: +2.5 / 0 / -5 */
function signed(v: number): string {
  const s = fmtNum(v, 1)
  return v > 0 ? `+${s}` : s
}

/** leading width from a tire spec string: "120/70ZR17" → "120" */
function tireWidth(spec: string): string {
  const m = /^\s*(\d+)/.exec(spec)
  return m?.[1] ?? spec
}

function sagStr(m: SagMeasurement | undefined): string {
  return m ? `${m.l1}/${m.l2}/${m.l3}` : '—'
}

/** compact card summary, e.g. "fork +2.5 / rear +4 / 16-45 / 120+180" */
function specLine(s: Setup): string {
  return [
    `fork ${signed(s.forkHeightMm)}`,
    `rear ${signed(s.rearRideHeightMm)}`,
    `${s.frontSprocket}-${s.rearSprocket}`,
    `${tireWidth(s.frontTire)}+${tireWidth(s.rearTire)}`,
  ].join(' / ')
}

// ---------------------------------------------------------------------------
// derived state per setup — memoized: recomputes only when bike/setups change
// ---------------------------------------------------------------------------

const derivedMap = computed<Map<string, DerivedState>>(() => {
  const map = new Map<string, DerivedState>()
  const bike = store.activeBike
  if (!bike) return map
  for (const s of store.bikeSetups) {
    try {
      map.set(s.id, deriveState(bike, s))
    } catch {
      // unparseable setup (e.g. bad tire string) — card shows em dashes
    }
  }
  return map
})

interface CardVM {
  setup: Setup
  isActive: boolean
  isBaseline: boolean
  date: string
  spec: string
  trail: string
  wheelbase: string
}

const cards = computed<CardVM[]>(() =>
  store.bikeSetups.map((s) => {
    const d = derivedMap.value.get(s.id) ?? null
    return {
      setup: s,
      isActive: s.id === store.activeSetupId,
      isBaseline: s.id === store.baselineSetupId,
      date: new Date(s.createdAt).toLocaleDateString(),
      spec: specLine(s),
      trail: d ? `${d.geometry.trailMm.toFixed(1)} mm` : '—',
      wheelbase: d ? `${d.geometry.wheelbaseMm.toFixed(0)} mm` : '—',
    }
  }),
)

const onlyOneSetup = computed(() => store.bikeSetups.length <= 1)

// ---------------------------------------------------------------------------
// card actions
// ---------------------------------------------------------------------------

function onNewSetup(): void {
  const name = window.prompt('New setup name:')
  if (name && name.trim()) store.newSetup(name.trim())
}

function onLoad(s: Setup): void {
  store.selectSetup(s.id)
}

function onDuplicate(s: Setup): void {
  store.newSetup(`${s.name} copy`, s)
}

function onSetBaseline(s: Setup): void {
  store.setBaseline(s.id)
}

function onDelete(s: Setup): void {
  if (onlyOneSetup.value) return
  if (window.confirm(`Delete setup "${s.name}"?`)) store.deleteSetup(s.id)
}

// ---------------------------------------------------------------------------
// compare A/B
// ---------------------------------------------------------------------------

const compareA = ref('')
const compareB = ref('')

const setupA = computed<Setup | null>(
  () => store.bikeSetups.find((s) => s.id === compareA.value) ?? null,
)
const setupB = computed<Setup | null>(
  () => store.bikeSetups.find((s) => s.id === compareB.value) ?? null,
)

interface FieldDef {
  label: string
  fmt: (s: Setup) => string
}

const FIELDS: FieldDef[] = [
  { label: 'Name', fmt: (s) => s.name },
  { label: 'Notes', fmt: (s) => s.notes || '—' },
  { label: 'Fork height', fmt: (s) => `${signed(s.forkHeightMm)} mm` },
  { label: 'Rear ride height', fmt: (s) => `${signed(s.rearRideHeightMm)} mm` },
  { label: 'Chain adjuster', fmt: (s) => `${signed(s.chainAdjusterMm)} mm` },
  { label: 'Front spring', fmt: (s) => `${fmtNum(s.frontSpringNmm, 2)} N/mm` },
  { label: 'Rear spring', fmt: (s) => `${fmtNum(s.rearSpringNmm, 1)} N/mm` },
  { label: 'Front preload', fmt: (s) => `${fmtNum(s.frontPreloadMm, 1)} mm` },
  { label: 'Rear preload', fmt: (s) => `${fmtNum(s.rearPreloadMm, 1)} mm` },
  { label: 'Front sag L1/L2/L3', fmt: (s) => sagStr(s.frontSag) },
  { label: 'Rear sag L1/L2/L3', fmt: (s) => sagStr(s.rearSag) },
  { label: 'Front tire', fmt: (s) => s.frontTire },
  { label: 'Rear tire', fmt: (s) => s.rearTire },
  { label: 'Front sprocket', fmt: (s) => `${s.frontSprocket} T` },
  { label: 'Rear sprocket', fmt: (s) => `${s.rearSprocket} T` },
  { label: 'Chain links', fmt: (s) => (s.chainLinks === null ? 'auto' : String(s.chainLinks)) },
  { label: 'Rider', fmt: (s) => `${fmtNum(s.riderKg, 1)} kg` },
]

interface CmpRow {
  label: string
  a: string
  b: string
  diff: boolean
}

/** setup fields that differ between A and B */
const diffRows = computed<CmpRow[]>(() => {
  const a = setupA.value
  const b = setupB.value
  if (!a || !b) return []
  const rows: CmpRow[] = []
  for (const f of FIELDS) {
    const va = f.fmt(a)
    const vb = f.fmt(b)
    if (va !== vb) rows.push({ label: f.label, a: va, b: vb, diff: true })
  }
  return rows
})

interface DerivedRowDef {
  label: string
  fmt: (d: DerivedState) => string
}

const DERIVED_ROWS: DerivedRowDef[] = [
  { label: 'Rake', fmt: (d) => `${d.geometry.rakeDeg.toFixed(2)}°` },
  { label: 'Trail', fmt: (d) => `${d.geometry.trailMm.toFixed(1)} mm` },
  { label: 'Wheelbase', fmt: (d) => `${d.geometry.wheelbaseMm.toFixed(1)} mm` },
  { label: 'Swingarm', fmt: (d) => `${d.geometry.swingarmAngleDeg.toFixed(2)}°` },
  { label: 'Anti-squat', fmt: (d) => `${d.balance.antiSquatPct.toFixed(0)} %` },
  { label: 'Final drive', fmt: (d) => d.drivetrain.finalDrive.toFixed(3) },
]

/** derived rows — always shown, differing cells highlighted */
const derivedRows = computed<CmpRow[]>(() => {
  const a = setupA.value
  const b = setupB.value
  if (!a || !b) return []
  const da = derivedMap.value.get(a.id) ?? null
  const db = derivedMap.value.get(b.id) ?? null
  return DERIVED_ROWS.map((r) => {
    const va = da ? r.fmt(da) : '—'
    const vb = db ? r.fmt(db) : '—'
    return { label: r.label, a: va, b: vb, diff: !!(da && db) && va !== vb }
  })
})

// ---------------------------------------------------------------------------
// import / export
// ---------------------------------------------------------------------------

const fileInput = ref<HTMLInputElement | null>(null)

function onExport(): void {
  const blob = new Blob([store.exportJSON()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'motospec-export.json'
  a.click()
  URL.revokeObjectURL(url)
}

function onImportClick(): void {
  fileInput.value?.click()
}

function onImportFile(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const result = store.importJSON(String(reader.result))
      window.alert(`Imported ${result.bikes} bike(s) and ${result.setups} setup(s).`)
    } catch (err) {
      window.alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  reader.readAsText(file)
  input.value = '' // allow re-selecting the same file later
}
</script>

<template>
  <div class="garage">
    <!-- header row -->
    <div class="garage-head">
      <h2 class="garage-title">
        Garage<span v-if="store.activeBike" class="bike-name"> — {{ store.activeBike.name }}</span>
      </h2>
      <button class="btn btn-primary" :disabled="!store.activeBike" @click="onNewSetup">
        + New setup
      </button>
    </div>

    <!-- no bike at all -->
    <div v-if="!store.activeBike" class="empty">No bike selected.</div>

    <template v-else>
      <!-- setup cards -->
      <div v-if="!cards.length" class="empty">No setups yet — create one to get started.</div>
      <div v-else class="cards">
        <article
          v-for="c in cards"
          :key="c.setup.id"
          class="panel card"
          :class="{ active: c.isActive }"
        >
          <header class="card-head">
            <span class="card-name">{{ c.setup.name }}</span>
            <span v-if="c.isBaseline" class="tag tag-baseline">★ baseline</span>
            <span v-if="c.isActive" class="tag tag-active">● active</span>
          </header>

          <div class="card-date mono">{{ c.date }}</div>
          <div class="card-spec mono">{{ c.spec }}</div>
          <div class="card-derived mono">
            <span class="dlabel">trail</span> {{ c.trail }}
            <span class="dsep">·</span>
            <span class="dlabel">wb</span> {{ c.wheelbase }}
          </div>

          <div class="card-actions">
            <button class="btn btn-sm" :disabled="c.isActive" @click="onLoad(c.setup)">Load</button>
            <button class="btn btn-sm" @click="onDuplicate(c.setup)">Duplicate</button>
            <button class="btn btn-sm" :disabled="c.isBaseline" @click="onSetBaseline(c.setup)">
              Set baseline
            </button>
            <button
              class="btn btn-sm btn-danger"
              :disabled="onlyOneSetup"
              @click="onDelete(c.setup)"
            >
              Delete
            </button>
          </div>
        </article>
      </div>

      <!-- compare -->
      <section class="panel">
        <div class="panel-title">Compare</div>
        <div class="compare-body">
          <div v-if="store.bikeSetups.length < 2" class="empty-inline">
            Need at least two setups to compare.
          </div>
          <template v-else>
            <div class="compare-selects">
              <label>
                <span class="key key-a">A</span>
                <select v-model="compareA">
                  <option value="" disabled>— select —</option>
                  <option v-for="s in store.bikeSetups" :key="s.id" :value="s.id">
                    {{ s.name }}
                  </option>
                </select>
              </label>
              <label>
                <span class="key key-b">B</span>
                <select v-model="compareB">
                  <option value="" disabled>— select —</option>
                  <option v-for="s in store.bikeSetups" :key="s.id" :value="s.id">
                    {{ s.name }}
                  </option>
                </select>
              </label>
            </div>

            <div v-if="!setupA || !setupB" class="empty-inline">Select two setups to compare.</div>
            <table v-else class="cmp-table">
              <thead>
                <tr>
                  <th class="row-label"></th>
                  <th class="col-a">{{ setupA.name }}</th>
                  <th class="col-b">{{ setupB.name }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!diffRows.length">
                  <td colspan="3" class="no-diff">No setup fields differ.</td>
                </tr>
                <tr v-for="row in diffRows" :key="'f-' + row.label">
                  <td class="row-label">{{ row.label }}</td>
                  <td class="val">{{ row.a }}</td>
                  <td class="val">{{ row.b }}</td>
                </tr>
                <tr class="divider-row">
                  <td colspan="3">Derived</td>
                </tr>
                <tr v-for="row in derivedRows" :key="'d-' + row.label">
                  <td class="row-label">{{ row.label }}</td>
                  <td class="val" :class="{ diff: row.diff }">{{ row.a }}</td>
                  <td class="val" :class="{ diff: row.diff }">{{ row.b }}</td>
                </tr>
              </tbody>
            </table>
          </template>
        </div>
      </section>

      <!-- import / export -->
      <section class="panel">
        <div class="panel-title">Data transfer</div>
        <div class="io-row">
          <button class="btn" @click="onExport">Export JSON</button>
          <button class="btn" @click="onImportClick">Import JSON</button>
          <input
            ref="fileInput"
            type="file"
            accept=".json,application/json"
            class="file-input"
            @change="onImportFile"
          />
          <span class="io-note mono">custom bikes + setups · localStorage only</span>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.garage {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--gap);
}

/* --- header ------------------------------------------------------------ */

.garage-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap);
}

.garage-title {
  font-size: 18px;
  letter-spacing: 0.1em;
  color: var(--ink);
}

.bike-name {
  color: var(--orange);
}

/* --- buttons ------------------------------------------------------------ */

.btn {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  background: transparent;
  border: 1px solid var(--line-strong);
  border-radius: var(--rad);
  color: var(--ink-dim);
  padding: 6px 12px;
}
.btn:hover:not(:disabled) {
  color: var(--ink);
  border-color: var(--ink-dim);
}
.btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.btn-primary {
  color: var(--orange);
  border-color: var(--orange);
  background: var(--orange-soft);
}
.btn-primary:hover:not(:disabled) {
  color: var(--orange);
  border-color: var(--orange);
}

.btn-sm {
  font-size: 10px;
  padding: 4px 8px;
}

.btn-danger:hover:not(:disabled) {
  color: var(--bad);
  border-color: var(--bad);
}

/* --- setup cards --------------------------------------------------------- */

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--gap);
}

.card {
  padding: var(--pad);
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.card.active {
  border-color: var(--orange);
}

.card-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.card-name {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink);
}

.tag {
  font-family: var(--font-display);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border: 1px solid;
  border-radius: var(--rad);
  padding: 1px 6px;
  white-space: nowrap;
}
.tag-baseline {
  color: var(--cyan);
  border-color: var(--cyan);
  background: var(--cyan-soft);
}
.tag-active {
  color: var(--orange);
  border-color: var(--orange);
  background: var(--orange-soft);
}

.card-date {
  font-size: 11px;
  color: var(--ink-faint);
}

.card-spec {
  font-size: 12px;
  color: var(--ink-dim);
}

.card-derived {
  font-size: 12px;
  color: var(--bp-dim);
}
.dlabel {
  color: var(--ink-faint);
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.08em;
}
.dsep {
  color: var(--ink-faint);
  padding: 0 4px;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid var(--line);
}

/* --- compare -------------------------------------------------------------- */

.compare-body {
  padding: var(--pad);
  display: flex;
  flex-direction: column;
  gap: var(--gap);
}

.compare-selects {
  display: flex;
  gap: var(--gap);
  flex-wrap: wrap;
}
.compare-selects label {
  display: flex;
  align-items: center;
  gap: 8px;
}
.compare-selects select {
  min-width: 180px;
}

.key {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.1em;
}
.key-a {
  color: var(--orange);
}
.key-b {
  color: var(--cyan);
}

.cmp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.cmp-table th,
.cmp-table td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--line);
}
.cmp-table th {
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-align: right;
}
.cmp-table th.row-label {
  text-align: left;
}
.col-a {
  color: var(--orange);
}
.col-b {
  color: var(--cyan);
}

.row-label {
  font-size: 12px;
  color: var(--ink-dim);
  text-align: left;
}

.val {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
  color: var(--ink);
}
.val.diff {
  color: var(--orange);
}

.divider-row td {
  font-family: var(--font-display);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--ink-faint);
  background: var(--panel-raised);
  padding: 4px 10px;
}

.no-diff {
  color: var(--ink-faint);
  font-size: 12px;
}

/* --- import / export ------------------------------------------------------ */

.io-row {
  display: flex;
  align-items: center;
  gap: var(--gap);
  padding: var(--pad);
  flex-wrap: wrap;
}

.file-input {
  display: none;
}

.io-note {
  font-size: 11px;
  color: var(--ink-faint);
  margin-left: auto;
}

/* --- empty states ----------------------------------------------------------- */

.empty {
  padding: 36px var(--pad);
  text-align: center;
  font-size: 13px;
  color: var(--ink-faint);
  border: 1px dashed var(--line-strong);
  border-radius: var(--rad);
}

.empty-inline {
  font-size: 13px;
  color: var(--ink-faint);
}
</style>
