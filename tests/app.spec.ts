// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '../src/App.vue'
import { useSetupStore } from '../src/store/setups'
import { PRESET_BIKES } from '../src/core/presets'

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders the three tab buttons', () => {
    const wrapper = mount(App, { global: { plugins: [createPinia()] } })
    const tabLabels = wrapper.findAll('nav.tabs button').map((b) => b.text())
    expect(tabLabels).toEqual(['Workbench', 'Sag Wizard', 'Garage'])
    wrapper.unmount()
  })

  it('shows a preset bike name in the bike select after ensureActive()', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(App, { global: { plugins: [pinia] } })

    // App.vue calls ensureActive() onMounted; call again explicitly and settle.
    const store = useSetupStore()
    store.ensureActive()
    await wrapper.vm.$nextTick()

    const select = wrapper.find('.bike-select select')
    expect(select.exists()).toBe(true)

    const optionNames = select.findAll('option').map((o) => o.text())
    const presetNames = PRESET_BIKES.map((b) => b.name)
    for (const name of presetNames) expect(optionNames).toContain(name)

    // the active bike is a preset and is the selected option
    const firstPreset = PRESET_BIKES[0]
    expect(firstPreset).toBeDefined()
    expect((select.element as HTMLSelectElement).value).toBe(firstPreset!.id)

    // ensureActive also created a stock setup for it
    expect(store.activeSetup).not.toBeNull()
    expect(store.bikeSetups.length).toBeGreaterThan(0)
    wrapper.unmount()
  })
})
