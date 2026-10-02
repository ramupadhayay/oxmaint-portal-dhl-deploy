'use client'

// Pick the files that prove a job was done.
//
// The reading, the validation and the size cap all live in lib/fileEvidence.js,
// shared with the compliance portal that holds evidence against an obligation.
// What is here is only what this portal looks like.

import { useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import {
  ACCEPT, MAX_FILES, MAX_FILE_BYTES, pickFiles, prettySize,
} from '../lib/fileEvidence'

export default function EvidenceUpload({ files = [], onChange, disabled = false }) {
  const [problem, setProblem] = useState('')
  const [reading, setReading] = useState(false)
  const inputRef = useRef(null)

  const choose = async (e) => {
    // Copy the picked files out before clearing the input. A FileList is live:
    // resetting `value` empties the very list this handler is holding, so the
    // reset has to come second or nothing is ever attached — which is what was
    // happening, silently, to every upload in this portal.
    //
    // The input is cleared at all so that picking the same file twice in a row
    // still fires a change event.
    const picked = [...(e.target.files || [])]
    if (inputRef.current) inputRef.current.value = ''
    setProblem('')
    setReading(true)
    try {
      const { read, problems } = await pickFiles(picked, files.length)
      if (read.length) onChange([...files, ...read])
      if (problems.length) setProblem(problems.join(' · '))
    } catch (err) {
      setProblem(err.message || 'That file could not be read.')
    } finally {
      setReading(false)
    }
  }

  const full = files.length >= MAX_FILES

  return (
    <div className="space-y-2">
      <label
        className={`flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-5 text-center transition-colors ${
          files.length ? 'border-green-400 bg-green-50/60' : 'border-slate-300 bg-slate-50'
        } ${disabled || full || reading ? 'cursor-default opacity-70' : 'cursor-pointer hover:bg-slate-100'}`}
      >
        <input
          ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden"
          disabled={disabled || full || reading} onChange={choose}
        />
        <Upload className={`w-5 h-5 ${full ? 'text-slate-400' : 'text-indigo-600'}`} />
        <span className={`text-sm font-semibold ${full ? 'text-slate-400' : 'text-indigo-700'}`}>
          {reading ? 'Reading…' : full ? `${MAX_FILES} files attached` : files.length ? 'Attach another file' : 'Choose a file'}
        </span>
        <span className="text-[11px] text-slate-500">
          Photo, PDF, spreadsheet or document · up to {prettySize(MAX_FILE_BYTES)} each
        </span>
      </label>

      {problem && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] leading-relaxed text-red-700">
          {problem}
        </p>
      )}

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.fileName}-${i}`}
              className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5"
            >
              <Badge variant="secondary" className="text-[9.5px] px-1.5 py-0 shrink-0">{f.fileType}</Badge>
              <span className="flex-1 min-w-0 truncate text-xs font-medium text-slate-800" title={f.fileName}>
                {f.fileName}
              </span>
              <span className="text-[11px] text-slate-400 shrink-0">{prettySize(f.sizeBytes)}</span>
              <Button
                type="button" variant="ghost" size="sm" disabled={disabled}
                className="h-6 w-6 p-0 shrink-0 text-slate-400 hover:text-red-600"
                onClick={() => { setProblem(''); onChange(files.filter((_, n) => n !== i)) }}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
