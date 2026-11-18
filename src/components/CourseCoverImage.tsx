'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { DEFAULT_COURSE_COVER } from '@/lib/course-cover'

export default function CourseCoverImage({ courseId, coverImageUrl, sizes, alt = '' }: { courseId: string; coverImageUrl?: string | null; sizes: string; alt?: string }) {
  const fallback = `/api/public/course-thumbnail/${courseId}`
  const sources = [...new Set([coverImageUrl?.trim() || fallback, fallback, DEFAULT_COURSE_COVER])]
  const [attempt, setAttempt] = useState(0)
  useEffect(() => setAttempt(0), [courseId, coverImageUrl])
  const src = sources[Math.min(attempt, sources.length - 1)]
  // Uploaded covers can use hosts beyond the configured Unsplash image host.
  // Serve those directly; local images and Mux thumbnail proxies stay optimized.
  const unoptimized = !src.startsWith('/') && !src.startsWith('https://images.unsplash.com/')
  return <Image src={src} alt={alt} fill sizes={sizes} unoptimized={unoptimized} onError={() => setAttempt((current) => Math.min(current + 1, sources.length - 1))} />
}
