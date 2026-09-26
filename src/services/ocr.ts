// ---------------------------------------------------------------------------
// On-device OCR via Tesseract.js. Runs in the browser (no API, no key). The
// wasm + language data are fetched from a CDN on first use and then cached, so
// the first scan needs internet; later scans work offline. The worker is kept
// alive and reused so repeat scans are fast.
// ---------------------------------------------------------------------------

let workerPromise: Promise<any> | null = null

async function getWorker() {
  if (!workerPromise) {
    workerPromise = import('tesseract.js').then((mod: any) => {
      const createWorker = mod.createWorker || mod.default?.createWorker
      return createWorker('eng')
    })
  }
  return workerPromise
}

/** Recognise text in an image. Returns '' on failure. */
export async function ocrImage(image: Blob | File): Promise<string> {
  try {
    const worker = await getWorker()
    const { data } = await worker.recognize(image)
    return (data?.text ?? '').trim()
  } catch {
    return ''
  }
}

/** Warm up the OCR engine ahead of time (optional). */
export function preloadOcr() {
  getWorker().catch(() => {})
}
