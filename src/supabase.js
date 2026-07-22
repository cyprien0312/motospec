// ============================================================
// Shared component library backend (Supabase / PostgREST)
// ============================================================
//
// The component catalogs (chassis / forks / shocks / linkages) live in a
// single shared table `motospec_components` so every visitor of the public
// site sees and can contribute to the same library.
//
// Security model (enforced by Row Level Security, not key secrecy — the
// publishable key below is public by design):
//   - anyone may SELECT / INSERT / UPDATE
//   - nobody may hard-DELETE (removals are a soft-delete: deleted = true)
//   - every write is appended to motospec_components_history for rollback
//
// This module is transport only: plain fetch() against PostgREST, no SDK,
// keeping the app dependency-free. All functions throw on HTTP error so the
// caller can fall back to the bundled baseline + local cache when offline.

export const SUPABASE_URL = 'https://tlakhfplzjdtptodocbv.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_8WURPk4qP-cezdCya8LLnw_9UU3oakF';

const REST = `${SUPABASE_URL}/rest/v1/motospec_components`;
const BASE_HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

const CATALOG_KEYS = ['chassis', 'forks', 'shocks', 'linkages'];

function emptyCatalogs() {
  return Object.fromEntries(CATALOG_KEYS.map(k => [k, {}]));
}

// Fetch the whole live (non-deleted) shared library, shaped as
// { chassis:{id:entry}, forks:{...}, shocks:{...}, linkages:{...} }.
export async function fetchSharedCatalogs() {
  const url = `${REST}?select=catalog,entry_id,data&deleted=eq.false&order=updated_at.asc&limit=5000`;
  const res = await fetch(url, { headers: BASE_HEADERS });
  if (!res.ok) throw new Error(`fetchSharedCatalogs ${res.status}: ${await res.text()}`);
  const rows = await res.json();
  const out = emptyCatalogs();
  for (const r of rows) {
    if (out[r.catalog] && r.entry_id) out[r.catalog][r.entry_id] = r.data;
  }
  return out;
}

// Insert or update one entry (upsert on the (catalog, entry_id) unique key).
// `data` is the full entry object ({ name, manufacturer?, specs, note?, ... }).
// Returns the authoritative stored row's `data`.
export async function upsertSharedEntry(catalog, entryId, data, author = null) {
  const body = [{ catalog, entry_id: entryId, data, author, deleted: false }];
  const res = await fetch(`${REST}?on_conflict=catalog,entry_id`, {
    method: 'POST',
    headers: {
      ...BASE_HEADERS,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`upsertSharedEntry ${res.status}: ${await res.text()}`);
  const rows = await res.json();
  return rows[0]?.data ?? data;
}

// Soft-delete: flip deleted = true (hard delete is blocked by RLS anyway).
export async function softDeleteSharedEntry(catalog, entryId) {
  const q = `catalog=eq.${encodeURIComponent(catalog)}&entry_id=eq.${encodeURIComponent(entryId)}`;
  const res = await fetch(`${REST}?${q}`, {
    method: 'PATCH',
    headers: { ...BASE_HEADERS, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ deleted: true }),
  });
  if (!res.ok) throw new Error(`softDeleteSharedEntry ${res.status}: ${await res.text()}`);
}

// Publish many entries at once (used to migrate a browser-local overlay into
// the shared library). `overlay` is { catalog: { id: entry } }. Skips tombstones.
export async function bulkUpsertShared(overlay, author = null) {
  const rows = [];
  for (const cat of CATALOG_KEYS) {
    for (const [id, entry] of Object.entries(overlay?.[cat] || {})) {
      if (!entry || entry.__deleted) continue;
      rows.push({ catalog: cat, entry_id: id, data: entry, author, deleted: false });
    }
  }
  if (!rows.length) return 0;
  const res = await fetch(`${REST}?on_conflict=catalog,entry_id`, {
    method: 'POST',
    headers: {
      ...BASE_HEADERS,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`bulkUpsertShared ${res.status}: ${await res.text()}`);
  return rows.length;
}
