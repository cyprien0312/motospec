<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useSetupStore } from './store/setups'
import BlueprintView from './components/BlueprintView.vue'
import SetupPanel from './components/SetupPanel.vue'
import DeltaDash from './components/DeltaDash.vue'
import GarageView from './components/GarageView.vue'
import SagWizard from './components/SagWizard.vue'

const store = useSetupStore()
const tab = ref<'workbench' | 'sag' | 'garage'>('workbench')

onMounted(() => store.ensureActive())
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark">◉</span>
        <h1>Moto<span class="brand-accent">Spec</span></h1>
        <span class="brand-sub mono">static chassis setup</span>
      </div>

      <nav class="tabs">
        <button :class="{ active: tab === 'workbench' }" @click="tab = 'workbench'">Workbench</button>
        <button :class="{ active: tab === 'sag' }" @click="tab = 'sag'">Sag Wizard</button>
        <button :class="{ active: tab === 'garage' }" @click="tab = 'garage'">Garage</button>
      </nav>

      <div class="bike-select" v-if="store.activeBike">
        <select :value="store.activeBike.id" @change="store.selectBike(($event.target as HTMLSelectElement).value)">
          <option v-for="b in store.bikes" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
        <select
          v-if="store.bikeSetups.length"
          :value="store.activeSetupId ?? ''"
          @change="store.selectSetup(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="s in store.bikeSetups" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </div>
    </header>

    <main v-if="tab === 'workbench'" class="workbench">
      <section class="col-blueprint">
        <BlueprintView />
        <DeltaDash />
      </section>
      <aside class="col-controls">
        <SetupPanel />
      </aside>
    </main>

    <main v-else-if="tab === 'sag'" class="single">
      <SagWizard />
    </main>

    <main v-else class="single">
      <GarageView />
    </main>
  </div>
</template>

<style scoped>
.shell {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(180deg, var(--panel-raised), var(--panel));
}

.brand { display: flex; align-items: baseline; gap: 10px; }
.brand-mark { color: var(--orange); font-size: 18px; }
.brand h1 { font-size: 22px; letter-spacing: 0.04em; }
.brand-accent { color: var(--orange); }
.brand-sub { color: var(--ink-faint); font-size: 11px; }

.tabs { display: flex; gap: 2px; margin-left: auto; }
.tabs button {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--rad);
  color: var(--ink-dim);
  padding: 7px 16px;
}
.tabs button:hover { color: var(--ink); }
.tabs button.active {
  color: var(--orange);
  border-color: var(--orange);
  background: var(--orange-soft);
}

.bike-select { display: flex; gap: 8px; }

.workbench {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: var(--gap);
  padding: var(--gap);
  min-height: 0;
}

.col-blueprint {
  display: flex;
  flex-direction: column;
  gap: var(--gap);
  min-width: 0;
  min-height: 0;
}

.col-controls { min-height: 0; overflow-y: auto; }

.single {
  flex: 1;
  padding: var(--gap);
  overflow-y: auto;
}

@media (max-width: 1100px) {
  .workbench { grid-template-columns: 1fr; }
}
</style>
