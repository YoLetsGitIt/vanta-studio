const store = new Map();
const TTL = 2 * 60 * 1000; // 2 minutes

export function getCached(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL) { store.delete(key); return null; }
  return entry.data;
}

export function setCached(key, data) {
  store.set(key, { data, ts: Date.now() });
}

export function invalidate(...keys) {
  keys.forEach(k => store.delete(k));
}

export function invalidatePrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
