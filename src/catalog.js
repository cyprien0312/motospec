// ============================================================
// Component catalog loader + mutable user-overlay
// ============================================================
//
// Each baseline catalog is loaded from data/<catalog>.json. The
// effective catalog visible to the rest of the app (`CATALOGS`) is
// rebuilt as `BASE ⊕ userOverlay`, where the user overlay can:
//   - add new entries (id not in BASE)
//   - replace/extend entries (deep-merge wins for `specs`)
//   - tombstone baseline entries (`{ __deleted: true }`)
//
// Consumers should always read from the live `CATALOGS` object — never
// cache an inner `CATALOGS.<catalog>` reference, since each rebuild
// reassigns those properties.

import FORKS     from '../data/forks.json'     with { type: 'json' };
import SHOCKS    from '../data/shocks.json'    with { type: 'json' };
import SWINGARMS from '../data/swingarms.json' with { type: 'json' };
import LINKAGES  from '../data/linkages.json'  with { type: 'json' };
import CHASSIS   from '../data/chassis.json'   with { type: 'json' };

const BASE = Object.freeze({
  forks: FORKS, shocks: SHOCKS, swingarms: SWINGARMS,
  linkages: LINKAGES, chassis: CHASSIS,
});

export const CATALOG_KEYS = Object.keys(BASE);

// User-supplied overlay. Each per-catalog object maps id → entry, where
// `{ __deleted: true }` tombstones a baseline entry.
let userOverlay = Object.fromEntries(CATALOG_KEYS.map(k => [k, {}]));

export const CATALOGS = {};
rebuild();

function deepClone(v) {
  // structuredClone is available in Node 22 + all modern browsers.
  return structuredClone(v);
}

function rebuild() {
  for (const cat of CATALOG_KEYS) {
    const merged = {};
    for (const [id, entry] of Object.entries(BASE[cat])) merged[id] = deepClone(entry);
    for (const [id, entry] of Object.entries(userOverlay[cat] || {})) {
      if (entry && entry.__deleted) {
        delete merged[id];
      } else {
        // For entries that override a baseline, deep-merge specs so the
        // user can change one field without dropping the rest.
        const existing = merged[id];
        if (existing) {
          merged[id] = {
            ...existing,
            ...entry,
            specs: { ...(existing.specs || {}), ...(entry.specs || {}) },
          };
        } else {
          merged[id] = deepClone(entry);
        }
      }
    }
    CATALOGS[cat] = merged;
  }
}

export function setCatalogEntry(catalogKey, id, entry) {
  if (!CATALOG_KEYS.includes(catalogKey)) throw new Error(`Unknown catalog: ${catalogKey}`);
  if (!id) throw new Error('id required');
  userOverlay[catalogKey] = { ...userOverlay[catalogKey], [id]: deepClone(entry) };
  rebuild();
}

// Patch a single field (e.g. spec value or top-level name). Walks into
// .specs.<field> if `fieldPath` starts with 'specs.'.
export function patchCatalogEntry(catalogKey, id, fieldPath, value) {
  const existing = CATALOGS[catalogKey]?.[id];
  if (!existing) throw new Error(`No entry ${catalogKey}/${id}`);
  const next = deepClone(existing);
  if (fieldPath.startsWith('specs.')) {
    const k = fieldPath.slice('specs.'.length);
    next.specs = next.specs || {};
    next.specs[k] = value;
  } else {
    next[fieldPath] = value;
  }
  setCatalogEntry(catalogKey, id, next);
}

export function removeCatalogEntry(catalogKey, id) {
  if (!CATALOG_KEYS.includes(catalogKey)) throw new Error(`Unknown catalog: ${catalogKey}`);
  if (BASE[catalogKey][id]) {
    // Tombstone baseline entry
    userOverlay[catalogKey] = { ...userOverlay[catalogKey], [id]: { __deleted: true } };
  } else {
    // Drop user-only entry
    const next = { ...userOverlay[catalogKey] };
    delete next[id];
    userOverlay[catalogKey] = next;
  }
  rebuild();
}

export function getUserOverlay() {
  return deepClone(userOverlay);
}

export function applyUserOverlay(overlay) {
  if (!overlay || typeof overlay !== 'object') return;
  const fresh = Object.fromEntries(CATALOG_KEYS.map(k => [k, {}]));
  for (const k of CATALOG_KEYS) {
    if (overlay[k] && typeof overlay[k] === 'object') fresh[k] = deepClone(overlay[k]);
  }
  userOverlay = fresh;
  rebuild();
}

export function resetUserOverlay() {
  applyUserOverlay({});
}

// ----- Bike materialization (Phase 1) -----

const COMPONENT_TO_CATALOG = {
  chassis: 'chassis',
  fork: 'forks',
  shock: 'shocks',
  swingarm: 'swingarms',
  linkage: 'linkages',
};

// Order matters: chassis baseline first so component-level specs (forks,
// shocks, …) and per-bike geometry / setup overrides can win.
const COMPONENT_ORDER = [
  'chassis', 'fork', 'shock', 'swingarm', 'linkage',
];

export const COMPONENT_TO_CATALOG_MAP = COMPONENT_TO_CATALOG;

function lookupComponent(catalogKey, id) {
  const cat = CATALOGS[catalogKey];
  if (!cat) throw new Error(`Unknown catalog: ${catalogKey}`);
  if (id == null) return null;
  const entry = cat[id];
  if (!entry) throw new Error(`Catalog "${catalogKey}" has no entry "${id}"`);
  return entry;
}

export function materializeBikeInputs(bike) {
  const out = {};

  for (const key of COMPONENT_ORDER) {
    const id = bike.components?.[key];
    if (id == null) continue;
    const entry = lookupComponent(COMPONENT_TO_CATALOG[key], id);
    if (entry?.specs) Object.assign(out, entry.specs);
  }

  if (bike.geometry)    Object.assign(out, bike.geometry);
  if (bike.environment) Object.assign(out, bike.environment);
  if (bike.setup)       Object.assign(out, bike.setup);

  if (bike.components?.front_sprocket != null) out.Front_Sprocket = bike.components.front_sprocket;
  if (bike.components?.rear_sprocket  != null) out.Rear_Sprocket  = bike.components.rear_sprocket;

  if (bike.overrides) Object.assign(out, bike.overrides);

  return out;
}

export function componentName(bike, key) {
  const id = bike.components?.[key];
  if (id == null) return '';
  const cat = CATALOGS[COMPONENT_TO_CATALOG[key]];
  return cat?.[id]?.name ?? id;
}
