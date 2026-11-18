'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Play, Pause, Maximize2, Minimize2, Loader2, AlertCircle, Rewind, FastForward } from 'lucide-react'
import Hls from 'hls.js'
import { clampSeekTarget } from '@/lib/progress-credit'

interface VideoPlayerProps {
  playbackId: string
  courseId: string
  lessonId?: string
  initialPosition?: number
  initialWatchedRanges?: { start: number; end: number }[]
  onProgress?: (watchedSeconds: number, durationSeconds: number, watchedRanges: { start: number; end: number }[], lastPositionSeconds: number) => void
  onComplete?: () => void
  restrictSeeking?: boolean
}

export default function VideoPlayer({ playbackId, courseId, lessonId, initialPosition = 0, initialWatchedRanges = [], onProgress, onComplete, restrictSeeking = true }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [src, setSrc] = useState('')
  const [seekNotice, setSeekNotice] = useState('')
  const saveInterval = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const lastSaveAtRef = useRef(0)
  const lastObservedTimeRef = useRef(0)
  const lastDurationRef = useRef(0)
  const lastObservationAtRef = useRef(Date.now())
  const watchedRangesRef = useRef<{ start: number; end: number }[]>([])
  const initialWatchedRangesRef = useRef(initialWatchedRanges)
  initialWatchedRangesRef.current = initialWatchedRanges
  const seekingRef = useRef(false)
  const onProgressRef = useRef(onProgress)
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const overControlsRef = useRef(false)

  useEffect(() => { onProgressRef.current = onProgress }, [onProgress])

  const [controlsShown, setControlsShown] = useState(true)

  const revealControls = useCallback(() => {
    setControlsShown(true)
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current)
    hideControlsTimerRef.current = setTimeout(() => {
      const video = videoRef.current
      if (video && !video.paused && !overControlsRef.current) setControlsShown(false)
    }, 2000)
  }, [])

  useEffect(() => {
    if (!playing) {
      setControlsShown(true)
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current)
      return
    }
    revealControls()
  }, [playing, revealControls])

  useEffect(() => {
    if (fullscreen) revealControls()
  }, [fullscreen, revealControls])

  // Keep the `fullscreen` state in sync when the user exits with the Escape
  // key, so the overlay hide logic does not stay locked to fullscreen.
  useEffect(() => {
    function onFullscreenChange() {
      setFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const currentVideo = videoRef.current
    if (currentVideo) {
      currentVideo.pause()
      currentVideo.removeAttribute('src')
      currentVideo.load()
    }
    setSrc('')
    setError('')
    setLoading(true)
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    lastObservedTimeRef.current = 0
    lastDurationRef.current = 0
    lastObservationAtRef.current = Date.now()
    lastSaveAtRef.current = 0
    setSeekNotice('')
    // Restore saved coverage for this source so progress saves remain
    // cumulative across reloads and lesson switches.
    watchedRangesRef.current = initialWatchedRangesRef.current.map((range) => ({ ...range }))

    async function loadStream() {
      try {
        const res = await fetch(`/api/mux/playback/${playbackId}?courseId=${encodeURIComponent(courseId)}`, { signal: controller.signal })
        if (!res.ok) { setError('Unable to load video'); setLoading(false); return }
        const data = await res.json()
        setSrc(data.url)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setError('Unable to load video')
      }
      setLoading(false)
    }
    loadStream()
    return () => controller.abort()
  }, [playbackId, courseId, lessonId])

  useEffect(() => {
    if (!videoRef.current || !src) return
    const video = videoRef.current

    // Mux returns an HLS (.m3u8) stream. Safari supports HLS natively, but
    // Chromium/Firefox need a MediaSource HLS implementation such as hls.js.
    let hls: Hls | null = null
    if (Hls.isSupported()) {
      hls = new Hls()
      hls.loadSource(src)
      hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return
        let detail: string = data.type
        if (data.type === 'networkError' || data.type === 'mediaError') {
          const response = data.networkDetails as XMLHttpRequest | null
          if (response?.status) detail = `HTTP ${response.status}`
        }
        setError(`Video playback error (${detail})`)
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
    } else {
      setError('This browser cannot play HLS video')
    }

    if (initialPosition > 0 && video.duration) {
      try { video.currentTime = restrictSeeking ? clampSeekTarget(initialPosition, watchedRangesRef.current, video.duration) : Math.min(initialPosition, video.duration) } catch {}
    }
    return () => {
      hls?.destroy()
      video.removeAttribute('src')
      video.load()
    }
  // Do not reload the HLS source when the parent updates its saved progress.
  // `initialPosition` is applied by loadedmetadata for each new source; making
  // it an effect dependency would tear down and restart playback after every
  // progress save.
  }, [src])

  // Periodic progress save (every 10 seconds)
  const addWatchedRange = useCallback((start: number, end: number) => {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return
    const next = [...watchedRangesRef.current, { start: Math.max(0, start), end: Math.max(0, end) }].sort((a, b) => a.start - b.start)
    const merged: { start: number; end: number }[] = []
    for (const range of next) {
      const previous = merged[merged.length - 1]
      if (previous && range.start <= previous.end + 0.5) previous.end = Math.max(previous.end, range.end)
      else merged.push({ ...range })
    }
    watchedRangesRef.current = merged.slice(-500)
  }, [])

  const saveProgress = useCallback((time: number, dur: number, force = false) => {
    if (!force && Date.now() - lastSaveAtRef.current < 10000) return
    lastSaveAtRef.current = Date.now()
    const covered = watchedRangesRef.current.reduce((total, range) => total + range.end - range.start, 0)
    onProgressRef.current?.(Math.floor(covered), Math.floor(dur), watchedRangesRef.current.map((range) => ({ ...range })), Math.floor(Math.max(0, time)))
  }, [])

  useEffect(() => {
    saveInterval.current = setInterval(() => {
      const video = videoRef.current
      if (video && !video.paused && video.duration) {
        saveProgress(video.currentTime, video.duration)
      }
    }, 10000)
    function saveBeforeLeaving() {
      const video = videoRef.current
      if (video && Number.isFinite(video.duration) && video.duration > 0) saveProgress(video.currentTime, video.duration, true)
    }
    window.addEventListener('pagehide', saveBeforeLeaving)
    return () => {
      clearInterval(saveInterval.current)
      window.removeEventListener('pagehide', saveBeforeLeaving)
      const video = videoRef.current
      // React clears the video ref before passive cleanup when a lesson is
      // replaced. Keep the last observed values so its final progress is saved.
      const duration = video?.duration ?? lastDurationRef.current
      if (Number.isFinite(duration) && duration > 0) saveProgress(video?.currentTime ?? lastObservedTimeRef.current, duration, true)
      clearTimeout(hideControlsTimerRef.current)
    }
  }, [saveProgress])

  function handleTimeUpdate() {
    if (!videoRef.current) return
    const video = videoRef.current
    const time = video.currentTime
    if (!seekingRef.current && !video.paused) {
      const delta = time - lastObservedTimeRef.current
      const elapsed = Math.max(0, (Date.now() - lastObservationAtRef.current) / 1000)
      const normalAdvance = elapsed * (video.playbackRate || 1) + 0.75
      if (delta > normalAdvance && restrictSeeking) { seekTo(time); return }
      if (delta > 0 && delta <= normalAdvance) addWatchedRange(lastObservedTimeRef.current, time)
    }
    lastObservedTimeRef.current = time
    lastObservationAtRef.current = Date.now()
    setCurrentTime(time)
    setDuration(video.duration)
    if (Number.isFinite(video.duration)) lastDurationRef.current = video.duration
  }

  function handleLoadedMetadata() {
    if (!videoRef.current) return
    setDuration(videoRef.current.duration)
    if (Number.isFinite(videoRef.current.duration)) lastDurationRef.current = videoRef.current.duration
    if (initialPosition > 0) {
      videoRef.current.currentTime = restrictSeeking ? clampSeekTarget(initialPosition, watchedRangesRef.current, videoRef.current.duration) : Math.min(initialPosition, videoRef.current.duration)
    }
    lastObservedTimeRef.current = videoRef.current.currentTime
    lastObservationAtRef.current = Date.now()
  }

  function handleEnded() {
    setPlaying(false)
    if (videoRef.current) {
      const remaining = videoRef.current.duration - lastObservedTimeRef.current
      const elapsed = (Date.now() - lastObservationAtRef.current) / 1000 + 0.75
      if (remaining > 0 && remaining <= elapsed * (videoRef.current.playbackRate || 1)) addWatchedRange(lastObservedTimeRef.current, videoRef.current.duration)
      lastObservedTimeRef.current = videoRef.current.duration
      saveProgress(videoRef.current.duration, videoRef.current.duration, true)
    }
    onComplete?.()
  }

  function togglePlay() {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => setError('Unable to start playback. Please try again.'))
      lastObservedTimeRef.current = videoRef.current.currentTime
      lastObservationAtRef.current = Date.now()
    } else {
      videoRef.current.pause()
      setPlaying(false)
      saveProgress(videoRef.current.currentTime, videoRef.current.duration, true)
    }
  }

  async function toggleFullscreen() {
    const video = videoRef.current
    const container = video?.parentElement
    if (!video || !container) return

    const nativeVideo = video as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void
      webkitExitFullscreen?: () => void
      webkitDisplayingFullscreen?: boolean
    }

    if (nativeVideo.webkitDisplayingFullscreen) {
      nativeVideo.webkitExitFullscreen?.()
      setFullscreen(false)
      return
    }

    if (document.fullscreenElement) {
      if (typeof document.exitFullscreen === 'function') await document.exitFullscreen()
      setFullscreen(false)
      return
    }

    // iOS Safari does not expose requestFullscreen on arbitrary elements.
    if (typeof container.requestFullscreen !== 'function') {
      if (typeof nativeVideo.webkitEnterFullscreen === 'function') {
        nativeVideo.webkitEnterFullscreen()
        setFullscreen(true)
      }
      return
    }

    try {
      await container.requestFullscreen()
      setFullscreen(true)
    } catch {
      setFullscreen(false)
    }
  }

  function seekTo(target: number) {
    if (!videoRef.current || !Number.isFinite(videoRef.current.duration)) return
    const requested = Math.max(0, Math.min(videoRef.current.duration, target))
    const allowed = restrictSeeking ? clampSeekTarget(requested, watchedRangesRef.current, videoRef.current.duration) : requested
    if (requested > allowed + 0.05) setSeekNotice('Watch this part of the video before skipping ahead.')
    videoRef.current.currentTime = allowed
    setCurrentTime(allowed)
    revealControls()
  }

  function seekBy(seconds: number) {
    if (videoRef.current) seekTo(videoRef.current.currentTime + seconds)
  }

  function handlePlayerKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    if (target.matches('button, input, textarea, select, [contenteditable="true"]')) return
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault()
      togglePlay()
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      seekBy(-10)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      seekBy(10)
    }
  }

  function handleSeeking() {
    seekingRef.current = true
    const video = videoRef.current
    if (video && restrictSeeking && Number.isFinite(video.duration)) {
      const allowed = clampSeekTarget(video.currentTime, watchedRangesRef.current, video.duration)
      if (video.currentTime > allowed + 0.05) {
        video.currentTime = allowed
        setSeekNotice('Watch this part of the video before skipping ahead.')
      }
    }
  }
  function handleSeeked() {
    if (!videoRef.current) return
    lastObservedTimeRef.current = videoRef.current.currentTime
    lastObservationAtRef.current = Date.now()
    setCurrentTime(videoRef.current.currentTime)
    seekingRef.current = false
  }

  function handleVideoError() {
    const mediaError = videoRef.current?.error
    const detail = mediaError?.code ? ` (media error ${mediaError.code})` : ''
    setError(`Video playback error${detail}`)
  }

  const elapsedStr = `${Math.floor(currentTime / 60)}:${String(Math.floor(currentTime % 60)).padStart(2, '0')}`

  if (error) {
    return (
      <div className="video-stage" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <AlertCircle size={32} style={{ color: '#e53e3e' }} />
        <p style={{ color: '#e53e3e' }}>{error}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="video-stage" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="spin" style={{ color: 'var(--blue)' }} />
      </div>
    )
  }

  if (!src) return null

  const controlsVisible = controlsShown

  return (
    <div className="video-stage" tabIndex={0} role="region" aria-label="Video player" onKeyDown={handlePlayerKeyDown} onPointerDown={revealControls} onMouseMove={() => { if (!controlsShown) revealControls() }} style={{ position: 'relative', overflow: 'hidden', background: '#000', cursor: fullscreen && !controlsShown ? 'none' : 'default' }}>
      <video
        ref={videoRef}
        onTimeUpdate={handleTimeUpdate}
        onSeeking={handleSeeking}
        onSeeked={handleSeeked}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => { setPlaying(true); lastObservationAtRef.current = Date.now(); if (videoRef.current?.duration) saveProgress(videoRef.current.currentTime, videoRef.current.duration, true) }}
        onPause={() => { setPlaying(false); if (videoRef.current?.duration) saveProgress(videoRef.current.currentTime, videoRef.current.duration, true) }}
        onError={handleVideoError}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        playsInline
      />
      {seekNotice && <p role="status" style={{ position: 'absolute', top: 12, left: 12, right: 12, margin: 0, padding: '8px 12px', borderRadius: 6, background: 'rgba(0,0,0,.8)', color: '#fff', fontSize: 12 }}>{seekNotice}</p>}
      <div className="video-controls" onMouseEnter={() => { overControlsRef.current = true; if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current) }} onMouseLeave={() => { overControlsRef.current = false; revealControls() }} style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        display: 'block',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.88))',
        padding: '44px 20px 18px', color: '#fff',
        opacity: controlsVisible ? 1 : 0,
        pointerEvents: controlsVisible ? 'auto' : 'none',
        transition: 'opacity .25s ease',
      }}>
        <label htmlFor={`video-seek-${lessonId ?? courseId}`} style={{ display: 'block', color: '#fff', fontSize: 11, marginBottom: 9 }}>
          <span className="sr-only">Seek video</span>
          <input id={`video-seek-${lessonId ?? courseId}`} type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => seekTo(Number(event.target.value))} aria-label="Seek video" aria-describedby={restrictSeeking ? `video-seek-hint-${lessonId ?? courseId}` : undefined} style={{ display: 'block', width: '100%', height: 20, accentColor: '#7FA4D1', cursor: 'pointer' }} />
          {restrictSeeking && <span id={`video-seek-hint-${lessonId ?? courseId}`} style={{ display: 'block', marginTop: 4 }}>You can rewind and revisit parts you have watched.</span>}
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10, minHeight: 42 }}>
          <span style={{ justifySelf: 'start', color: '#fff', fontSize: 12, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{elapsedStr} / {duration > 0 ? formatTime(duration) : '0:00'}</span>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <button type="button" onClick={() => seekBy(-10)} aria-label="Rewind 10 seconds" style={controlButtonStyle}><Rewind size={18} /></button>
          <button type="button" onClick={togglePlay} aria-label={playing ? 'Pause video' : 'Play video'} style={{ ...controlButtonStyle, width: 46, height: 46, background: 'var(--blue)', borderColor: 'var(--blue)' }}>{playing ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}</button>
          <button type="button" onClick={() => seekBy(10)} aria-label="Forward 10 seconds" disabled={restrictSeeking && clampSeekTarget(Math.min(duration, currentTime + 10), watchedRangesRef.current, duration) <= currentTime} style={{ ...controlButtonStyle, opacity: restrictSeeking && clampSeekTarget(Math.min(duration, currentTime + 10), watchedRangesRef.current, duration) <= currentTime ? .4 : 1 }}><FastForward size={18} /></button>
          </div>
          <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} style={{ ...controlButtonStyle, justifySelf: 'end' }}>{fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
        </div>
      </div>
    </div>
  )
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

const controlButtonStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  display: 'grid',
  placeItems: 'center',
  border: '1px solid rgba(255,255,255,.35)',
  borderRadius: 8,
  background: 'rgba(15,23,42,.72)',
  color: '#fff',
  cursor: 'pointer',
}
