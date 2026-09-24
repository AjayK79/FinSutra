// Short, sortable, collision-resistant ids. No external dep.
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

function randomPart(len: number) {
  let out = ''
  const bytes =
    typeof crypto !== 'undefined' && crypto.getRandomValues
      ? crypto.getRandomValues(new Uint8Array(len))
      : Array.from({ length: len }, () => Math.floor(Math.random() * 256))
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

/** Prefix + timestamp + random. e.g. txn_lz9k2b_a8f3 */
export function uid(prefix = 'id'): string {
  const ts = Date.now().toString(36)
  return `${prefix}_${ts}_${randomPart(5)}`
}

export function deviceId(): string {
  try {
    const KEY = 'finsutra_device_id'
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = `DEV-${randomPart(8).toUpperCase()}`
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return `DEV-${randomPart(8).toUpperCase()}`
  }
}
