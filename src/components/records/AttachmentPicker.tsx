import { useRef } from 'react'
import { Camera, Paperclip, X, FileText, ImageIcon } from 'lucide-react'
import { humanFileSize, isImage } from '@/lib/files'

export function AttachmentPicker({
  files,
  onChange,
  label = 'Attach receipt / document',
}: {
  files: File[]
  onChange: (files: File[]) => void
  label?: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const add = (list: FileList | null) => {
    if (!list) return
    onChange([...files, ...Array.from(list)])
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => { add(e.target.files); e.target.value = '' }}
      />
      {/* Opens the rear camera directly on mobile; falls back to file picker on desktop */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { add(e.target.files); e.target.value = '' }}
      />
      {files.length === 0 ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-dashed border-ink-300 bg-ink-50/50 px-3 py-3 text-sm font-medium text-ink-600 transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-600"
          >
            <Camera className="h-4 w-4" />
            Take photo
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-dashed border-ink-300 bg-ink-50/50 px-3 py-3 text-sm font-medium text-ink-600 transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-600"
          >
            <Paperclip className="h-4 w-4" />
            Upload
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-xl border border-ink-200 bg-white px-3 py-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                {isImage(f.type) ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-700">{f.name}</p>
                <p className="text-xs text-ink-400">{humanFileSize(f.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 hover:bg-rose-50 hover:text-rose-500"
                aria-label="Remove attachment"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex gap-3">
            <button type="button" onClick={() => cameraRef.current?.click()} className="text-xs font-medium text-brand-600 hover:underline">
              + Take photo
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} className="text-xs font-medium text-brand-600 hover:underline">
              + Add file
            </button>
          </div>
        </div>
      )}
      <p className="sr-only">{label}</p>
    </div>
  )
}
