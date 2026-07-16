<script setup lang="ts">
/**
 * DeltaDash — readout strip under the blueprint.
 * Metric cards from store.derived with deltas vs store.baselineDerived.
 * Delta colors are neutral/contextual: positive = orange, negative = cyan.
 */
import { computed } from 'vue'
import { useSetupStore } from '../store/setups'

const store = useSetupStore()

interface Card {
  label: string
  value: string
  unit: string
  /** formatted delta line, null = hidden (no baseline / same setup / zero) */
  delta: string | null
  dir: -1 | 0 | 1
}

const derived = computed(() => store.derived)

/** Deltas only when a baseline exists AND it is not the active setup itself. */
const showDeltas = computed(
  () => store.baselineDerived !== null && store.baselineSetupId !== store.activeSetupId,
)

const deltaTitle = computed(() => {
  const name = store.baselineSetup?.name
  return name ? `vs baseline ${name}` : 'vs baseline'
})

function mk(
  label: string,
  unit: string,
  dp: number,
  cur: number,
  base: number | null | undefined,
  valueOverride?: string,
): Card {
  let delta: string | null = null
  let dir: -1 | 0 | 1 = 0
  if (base !== null && base !== undefined) {
    const rounded = Number((cur - base).toFixed(dp))
    if (rounded > 0) {
      dir = 1
      delta = `▲ +${rounded.toFixed(dp)}`
    } else if (rounded < 0) {
      dir = -1
      delta = `▼ −${Math.abs(rounded).toFixed(dp)}`
    }
  }
  return { label, value: valueOverride ?? cur.toFixed(dp), unit, delta, dir }
}

const cards = computed<Card[]>(() => {
  const d = store.derived
  if (!d) return []
  const b = showDeltas.value ? store.baselineDerived : null

  const list: Card[] = [
    mk('Rake', '°', 1, d.geometry.rakeDeg, b?.geometry.rakeDeg),
    mk('Trail', 'mm', 1, d.geometry.trailMm, b?.geometry.trailMm),
    mk('Wheelbase', 'mm', 0, d.geometry.wheelbaseMm, b?.geometry.wheelbaseMm),
    mk('Swingarm', '°', 1, d.geometry.swingarmAngleDeg, b?.geometry.swingarmAngleDeg),
    mk('Anti-squat', '%', 0, d.balance.antiSquatPct, b?.balance.antiSquatPct),
    mk(
      'Weight f/r',
      '%',
      1,
      d.balance.weightFrontPct,
      b?.balance.weightFrontPct,
      `${d.balance.weightFrontPct.toFixed(1)} / ${d.balance.weightRearPct.toFixed(1)}`,
    ),
    mk('Final drive', '', 2, d.drivetrain.finalDrive, b?.drivetrain.finalDrive),
    mk('Chain', 'links', 0, d.drivetrain.chainLinksRequired, b?.drivetrain.chainLinksRequired),
  ]

  const speeds = d.drivetrain.speedPer1000Rpm
  const top = speeds[speeds.length - 1]
  if (top !== undefined) {
    const bSpeeds = b?.drivetrain.speedPer1000Rpm
    const bTop = bSpeeds ? bSpeeds[bSpeeds.length - 1] : undefined
    list.push(mk('Top gear', 'km/h @1k', 1, top, bTop))
  }

  return list
})
</script>

<template>
  <section v-if="derived" class="panel dash">
    <div class="grid">
      <div v-for="c in cards" :key="c.label" class="card">
        <div class="label">{{ c.label }}</div>
        <div class="value">
          <span class="num" :class="{ long: c.value.length > 7 }">{{ c.value }}</span>
          <span v-if="c.unit" class="unit">{{ c.unit }}</span>
        </div>
        <div
          v-if="c.delta"
          class="delta"
          :class="c.dir > 0 ? 'pos' : 'neg'"
          :title="deltaTitle"
        >
          {{ c.delta }}
        </div>
      </div>
    </div>

    <div v-if="derived.warnings.length" class="warnings">
      <span v-for="(w, i) in derived.warnings" :key="i" class="chip">&#9888; {{ w }}</span>
    </div>
  </section>
</template>

<style scoped>
.dash {
  padding: 10px var(--pad) 12px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
  gap: 8px;
}

.card {
  background: var(--panel-raised);
  border: 1px solid var(--line);
  border-radius: var(--rad);
  padding: 8px 10px 7px;
  min-width: 0;
}

.label {
  font-family: var(--font-display);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--ink-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-top: 2px;
  min-width: 0;
}

.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 20px;
  line-height: 1.15;
  color: var(--ink);
  white-space: nowrap;
}

/* long composite values (e.g. "51.8 / 48.2") step down to stay inside the card */
.num.long {
  font-size: 15px;
}

.unit {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 10px;
  color: var(--ink-dim);
  white-space: nowrap;
}

.delta {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  margin-top: 2px;
  white-space: nowrap;
}

.delta.pos {
  color: var(--orange);
}

.delta.neg {
  color: var(--cyan);
}

.warnings {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.chip {
  font-size: 11px;
  line-height: 1.35;
  color: var(--warn);
  border: 1px solid var(--warn);
  border-radius: var(--rad);
  background: color-mix(in srgb, var(--warn) 12%, transparent);
  padding: 3px 8px;
}
</style>
