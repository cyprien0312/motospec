/**
 * Pinia store — bikes, setups, persistence, derived state.
 * UI components consume ONLY this store + core types.
 */
import { defineStore } from 'pinia'
import type { BikeProfile, DerivedState, Setup } from '../core/types'
import { deriveState } from '../core/derive'
import { PRESET_BIKES, defaultSetup } from '../core/presets'

const LS_KEY = 'motospec.v1'

interface PersistShape {
  customBikes: BikeProfile[]
  setups: Setup[]
  activeBikeId: string | null
  activeSetupId: string | null
  baselineSetupId: string | null
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function load(): PersistShape | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as PersistShape) : null
  } catch {
    return null
  }
}

export const useSetupStore = defineStore('setups', {
  state: () => {
    const saved = load()
    return {
      customBikes: saved?.customBikes ?? ([] as BikeProfile[]),
      setups: saved?.setups ?? ([] as Setup[]),
      activeBikeId: saved?.activeBikeId ?? null,
      activeSetupId: saved?.activeSetupId ?? null,
      /** ghost overlay + delta reference */
      baselineSetupId: saved?.baselineSetupId ?? null,
    }
  },

  getters: {
    bikes(state): BikeProfile[] {
      return [...PRESET_BIKES, ...state.customBikes]
    },
    activeBike(state): BikeProfile | null {
      const all = [...PRESET_BIKES, ...state.customBikes]
      return all.find((b) => b.id === state.activeBikeId) ?? all[0] ?? null
    },
    bikeSetups(state): Setup[] {
      const bike = (this as { activeBike: BikeProfile | null }).activeBike
      return bike ? state.setups.filter((s) => s.bikeId === bike.id) : []
    },
    activeSetup(state): Setup | null {
      return state.setups.find((s) => s.id === state.activeSetupId) ?? null
    },
    baselineSetup(state): Setup | null {
      return state.setups.find((s) => s.id === state.baselineSetupId) ?? null
    },
    derived(): DerivedState | null {
      const bike = this.activeBike
      const setup = this.activeSetup
      return bike && setup ? deriveState(bike, setup) : null
    },
    baselineDerived(): DerivedState | null {
      const bike = this.activeBike
      const setup = this.baselineSetup
      if (!bike || !setup || setup.bikeId !== bike.id) return null
      return deriveState(bike, setup)
    },
  },

  actions: {
    persist() {
      const shape: PersistShape = {
        customBikes: this.customBikes,
        setups: this.setups,
        activeBikeId: this.activeBikeId,
        activeSetupId: this.activeSetupId,
        baselineSetupId: this.baselineSetupId,
      }
      localStorage.setItem(LS_KEY, JSON.stringify(shape))
    },

    /** Ensure there is an active bike + setup (call on app mount). */
    ensureActive() {
      if (!this.activeBike) return
      this.activeBikeId = this.activeBike.id
      if (!this.activeSetup || this.activeSetup.bikeId !== this.activeBikeId) {
        const existing = this.setups.find((s) => s.bikeId === this.activeBikeId)
        if (existing) {
          this.activeSetupId = existing.id
        } else {
          this.newSetup('Stock baseline')
          // first setup of a bike doubles as its baseline
          this.baselineSetupId = this.activeSetupId
        }
      }
      this.persist()
    },

    selectBike(bikeId: string) {
      this.activeBikeId = bikeId
      this.activeSetupId = null
      this.baselineSetupId = null
      this.ensureActive()
    },

    selectSetup(setupId: string) {
      const s = this.setups.find((x) => x.id === setupId)
      if (s) {
        this.activeBikeId = s.bikeId
        this.activeSetupId = s.id
        this.persist()
      }
    },

    newSetup(name: string, from?: Setup) {
      const bike = this.activeBike
      if (!bike) return
      const base: Setup = from
        ? { ...from, frontSag: from.frontSag && { ...from.frontSag }, rearSag: from.rearSag && { ...from.rearSag } }
        : defaultSetup(bike)
      const setup: Setup = { ...base, id: uid(), bikeId: bike.id, name, createdAt: new Date().toISOString() }
      this.setups.push(setup)
      this.activeSetupId = setup.id
      this.persist()
    },

    /** Patch the ACTIVE setup. */
    updateSetup(patch: Partial<Setup>) {
      const s = this.activeSetup
      if (!s) return
      Object.assign(s, patch)
      this.persist()
    },

    deleteSetup(setupId: string) {
      this.setups = this.setups.filter((s) => s.id !== setupId)
      if (this.activeSetupId === setupId) this.activeSetupId = null
      if (this.baselineSetupId === setupId) this.baselineSetupId = null
      this.ensureActive()
    },

    setBaseline(setupId: string | null) {
      this.baselineSetupId = setupId
      this.persist()
    },

    addCustomBike(bike: BikeProfile) {
      this.customBikes.push({ ...bike, id: uid(), preset: false })
      this.persist()
    },

    exportJSON(): string {
      return JSON.stringify({ customBikes: this.customBikes, setups: this.setups }, null, 2)
    },

    importJSON(raw: string): { bikes: number; setups: number } {
      const data = JSON.parse(raw) as Partial<PersistShape>
      const bikes = data.customBikes ?? []
      const setups = data.setups ?? []
      // re-id everything on import to avoid collisions
      for (const b of bikes) {
        const oldId = b.id
        b.id = uid()
        b.preset = false
        for (const s of setups) if (s.bikeId === oldId) s.bikeId = b.id
      }
      for (const s of setups) s.id = uid()
      this.customBikes.push(...bikes)
      this.setups.push(...setups)
      this.persist()
      return { bikes: bikes.length, setups: setups.length }
    },
  },
})
