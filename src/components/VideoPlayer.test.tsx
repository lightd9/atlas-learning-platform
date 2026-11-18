// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import VideoPlayer from '@/components/VideoPlayer'

vi.mock('hls.js', () => ({ default: { isSupported: () => false } }))

const now = new Date('2026-11-18T10:00:00Z')
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(now)
  vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably')
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: '/test-video.m3u8' }) }))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

async function player(props: Partial<Parameters<typeof VideoPlayer>[0]> = {}) {
  const result = render(<VideoPlayer playbackId="playback" courseId="course" {...props} />)
  const region = await screen.findByRole('region', { name: 'Video player' })
  const video = result.container.querySelector('video')!
  Object.defineProperty(video, 'duration', { configurable: true, value: 100 })
  fireEvent.loadedMetadata(video)
  return { ...result, region, video, slider: screen.getByRole('slider', { name: 'Seek video' }) }
}

describe('watched-only player controls', () => {
  it('blocks slider and keyboard jumps into unwatched video', async () => {
    const { video, slider, region } = await player({ initialWatchedRanges: [{ start: 0, end: 20 }] })
    fireEvent.change(slider, { target: { value: '80' } })
    expect(video.currentTime).toBe(20)
    expect(screen.getByRole('status')).toHaveTextContent('Watch this part')
    fireEvent.keyDown(region, { key: 'ArrowRight' })
    expect(video.currentTime).toBe(20)
    expect(screen.getByRole('button', { name: 'Forward 10 seconds' })).toBeDisabled()
  })

  it('allows rewind and revisiting earlier watched portions', async () => {
    const { video, slider, region } = await player({ initialWatchedRanges: [{ start: 0, end: 40 }], initialPosition: 30 })
    fireEvent.click(screen.getByRole('button', { name: 'Rewind 10 seconds' }))
    expect(video.currentTime).toBe(20)
    fireEvent.keyDown(region, { key: 'ArrowLeft' })
    expect(video.currentTime).toBe(10)
    fireEvent.change(slider, { target: { value: '35' } })
    expect(video.currentTime).toBe(35)
  })

  it('blocks native seeking used by mobile fullscreen controls', async () => {
    const { video } = await player({ initialWatchedRanges: [{ start: 0, end: 20 }] })
    video.currentTime = 90
    fireEvent.seeking(video)
    fireEvent.seeked(video)
    expect(video.currentTime).toBe(20)
  })

  it('clamps an old resume position to saved watched coverage', async () => {
    const { video } = await player({ initialWatchedRanges: [{ start: 0, end: 20 }], initialPosition: 90 })
    expect(video.currentTime).toBe(20)
  })

  it('credits ordinary playback even when timeupdate events arrive several seconds apart', async () => {
    const onProgress = vi.fn()
    const { video, slider } = await player({ onProgress })
    Object.defineProperty(video, 'paused', { configurable: true, value: false })
    fireEvent.play(video)
    expect(onProgress).toHaveBeenCalledWith(0, 100, [], 0)
    act(() => { vi.setSystemTime(now.getTime() + 8_000) })
    video.currentTime = 8
    fireEvent.timeUpdate(video)
    fireEvent.change(slider, { target: { value: '8' } })
    expect(video.currentTime).toBe(8)
    fireEvent.pause(video)
    expect(onProgress).toHaveBeenLastCalledWith(8, 100, [{ start: 0, end: 8 }], 8)
  })

  it('saves the final watched portion when switching away from a lesson', async () => {
    const onProgress = vi.fn()
    const { video, unmount } = await player({ onProgress })
    Object.defineProperty(video, 'paused', { configurable: true, value: false })
    fireEvent.play(video)
    act(() => { vi.setSystemTime(now.getTime() + 5_000) })
    video.currentTime = 5
    fireEvent.timeUpdate(video)
    unmount()
    expect(onProgress).toHaveBeenLastCalledWith(5, 100, [{ start: 0, end: 5 }], 5)
  })

  it('retains unrestricted slider, keyboard and native seeking for previews', async () => {
    const { video, slider, region } = await player({ restrictSeeking: false })
    fireEvent.change(slider, { target: { value: '80' } })
    expect(video.currentTime).toBe(80)
    fireEvent.keyDown(region, { key: 'ArrowRight' })
    expect(video.currentTime).toBe(90)
    video.currentTime = 95
    fireEvent.seeking(video)
    fireEvent.seeked(video)
    expect(video.currentTime).toBe(95)
    expect(screen.queryByText('You can rewind and revisit parts you have watched.')).not.toBeInTheDocument()
  })
})
