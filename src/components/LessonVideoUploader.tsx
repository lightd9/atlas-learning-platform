'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, FileVideo, Loader2, Upload, X } from 'lucide-react'

type UploadStatus = 'CREATING' | 'WAITING' | 'PROCESSING' | 'READY' | 'FAILED' | 'CANCELLED'
type UploadRecord = { id: string; status: UploadStatus; filename: string | null; playbackId: string | null; duration: number | null; errorMessage: string | null }

export default function LessonVideoUploader({ courseId, lessonId, currentPlaybackId, onReady }: { courseId: string; lessonId: string; currentPlaybackId?: string | null; onReady: (playbackId: string, durationSeconds?: number) => void }) {
  const [record, setRecord] = useState<UploadRecord | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const xhrRef = useRef<XMLHttpRequest | null>(null)
  const onReadyRef = useRef(onReady)
  const endpoint = `/api/admin/courses/${courseId}/lessons/${lessonId}/video-upload`

  useEffect(() => { onReadyRef.current = onReady }, [onReady])

  const refresh = useCallback(async () => {
    const response = await fetch(endpoint, { cache: 'no-store' })
    if (!response.ok) return
    const data = await response.json()
    setRecord(data.upload ?? null)
    if (data.upload?.status === 'READY' && data.upload.playbackId) onReadyRef.current(data.upload.playbackId, data.upload.duration ? Math.round(data.upload.duration) : undefined)
  }, [endpoint])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    if (record?.status !== 'WAITING' && record?.status !== 'PROCESSING') return
    const timer = window.setInterval(refresh, 4000)
    return () => window.clearInterval(timer)
  }, [record?.status, refresh])

  function chooseFile(next: File | null) {
    setError('')
    if (!next) return setFile(null)
    if (!next.type.startsWith('video/')) return setError('Choose a supported video file such as MP4 or MOV.')
    if (next.size <= 0) return setError('This video file is empty.')
    if (next.size > 10 * 1024 * 1024 * 1024) return setError('Videos must be smaller than 10 GB.')
    setFile(next)
  }

  async function startUpload() {
    if (!file) return
    setStarting(true); setError('')
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name, sizeBytes: file.size }) })
    const data = await response.json()
    setStarting(false)
    if (!response.ok) return setError(data.error ?? 'Unable to start video upload.')

    const xhr = new XMLHttpRequest()
    xhrRef.current = xhr
    setRecord({ id: data.uploadId, status: 'WAITING', filename: file.name, playbackId: null, duration: null, errorMessage: null })
    setProgress(0)
    xhr.open('PUT', data.url)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100)) }
    xhr.onload = () => {
      xhrRef.current = null
      setProgress(null)
      if (xhr.status >= 200 && xhr.status < 300) { setFile(null); setRecord((value) => value ? { ...value, status: 'PROCESSING' } : value); refresh() }
      else setError(`Mux rejected the upload (${xhr.status}). Please try again.`)
    }
    xhr.onerror = () => { xhrRef.current = null; setProgress(null); setError('The upload was interrupted. Check your connection and try again.') }
    xhr.onabort = () => { xhrRef.current = null; setProgress(null); setError('Upload cancelled.') }
    xhr.send(file)
  }

  async function removeVideo() {
    if (!window.confirm('Remove this video from the lesson? The Mux asset will be retained in your Mux account.')) return
    setError('')
    const response = await fetch(endpoint, { method: 'DELETE' })
    const data = await response.json()
    if (!response.ok) return setError(data.error ?? 'Unable to remove this video.')
    setRecord(null); setFile(null); onReadyRef.current('', 0)
  }

  const readyPlaybackId = record?.status === 'READY' ? record.playbackId : currentPlaybackId
  const busy = progress !== null || record?.status === 'PROCESSING'

  return <div style={{ border: '1px solid var(--line)', borderRadius: 9, padding: 12, background: '#fff', minWidth: 0 }}>
    <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
      {readyPlaybackId ? <CheckCircle2 size={18} color="var(--green)" /> : busy ? <Loader2 size={18} className="spin" color="var(--blue)" /> : <FileVideo size={18} color="var(--blue)" />}
      <div style={{ flex: 1, minWidth: 0 }} aria-live="polite">
        <strong style={{ fontSize: 12 }}>{readyPlaybackId ? 'Video ready' : progress !== null ? `Uploading ${file?.name ?? 'video'}` : record?.status === 'PROCESSING' ? 'Mux is processing this video' : 'Lesson video'}</strong>
        {progress !== null && <><div style={{ height: 6, background: '#e9edf4', borderRadius: 99, marginTop: 8, overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${progress}%`, background: 'var(--blue)' }} /></div><small style={{ display: 'block', marginTop: 5 }}>{progress}% uploaded. Keep this page open.</small></>}
        {record?.status === 'PROCESSING' && <small style={{ display: 'block', marginTop: 4, color: 'var(--muted)' }}>Upload complete. You can leave this page while processing continues.</small>}
        {!busy && file && <div style={{ marginTop: 7 }}><small style={{ display: 'block' }}>{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</small><button type="button" className="primary-button" onClick={startUpload} disabled={starting} style={{ marginTop: 8, height: 36 }}><Upload size={15} /> {starting ? 'Preparing...' : 'Upload video'}</button></div>}
        {!busy && !file && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><label className="secondary-button" style={{ marginTop: 8, height: 36, cursor: 'pointer' }}><Upload size={15} /> {readyPlaybackId ? 'Replace video' : 'Choose video'}<input type="file" accept="video/*,.mp4,.mov,.m4v,.webm" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} /></label>{readyPlaybackId && <button type="button" className="text-button" onClick={removeVideo} style={{ marginTop: 8, color: '#b42318', minHeight: 36 }}>Remove video</button>}</div>}
        {progress !== null && <button type="button" className="text-button" onClick={() => xhrRef.current?.abort()} style={{ marginTop: 8, color: '#b42318' }}><X size={14} /> Cancel upload</button>}
        {(error || record?.status === 'FAILED') && <p role="alert" style={{ color: '#b42318', fontSize: 11, margin: '8px 0 0', display: 'flex', gap: 5 }}><AlertCircle size={14} /> {error || record?.errorMessage || 'Mux could not process this video.'}</p>}
      </div>
    </div>
  </div>
}
