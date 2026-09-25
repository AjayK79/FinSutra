// Tiny pub/sub so data mutations can notify the sync engine without importing
// it (keeps repo.ts free of Google/sync dependencies).

type Cb = () => void
const subs = new Set<Cb>()

export function onLocalChange(cb: Cb): () => void {
  subs.add(cb)
  return () => subs.delete(cb)
}

export function emitLocalChange() {
  subs.forEach((cb) => {
    try {
      cb()
    } catch {
      /* ignore */
    }
  })
}
