import { describe, expect, it } from 'vitest'
import { audioMimeToExt } from './audioMime'

describe('audioMimeToExt', () => {
  it('maps iOS mp4/AAC containers to mp4', () => {
    expect(audioMimeToExt('audio/mp4')).toBe('mp4')
    expect(audioMimeToExt('audio/mp4;codecs=mp4a.40.2')).toBe('mp4')
  })

  it('keeps webm even when the codec hint is opus', () => {
    expect(audioMimeToExt('audio/webm;codecs=opus')).toBe('webm')
    expect(audioMimeToExt('audio/webm')).toBe('webm')
  })

  it('maps other supported containers', () => {
    expect(audioMimeToExt('audio/ogg')).toBe('ogg')
    expect(audioMimeToExt('audio/wav')).toBe('wav')
    expect(audioMimeToExt('audio/aac')).toBe('m4a')
    expect(audioMimeToExt('audio/mpeg')).toBe('mp3')
  })

  it('falls back to webm for null/unknown', () => {
    expect(audioMimeToExt(null)).toBe('webm')
    expect(audioMimeToExt(undefined)).toBe('webm')
    expect(audioMimeToExt('application/octet-stream')).toBe('webm')
  })
})
