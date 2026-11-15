import { describe, expect, it } from 'vitest'
import { AUDIO_BYTES_PER_SECOND, AUDIO_UNITS_PER_SECOND, audioUnits } from './units'

describe('audioUnits', () => {
  it('costs a clip by its length in seconds', () => {
    expect(audioUnits(10)).toBe(10 * AUDIO_UNITS_PER_SECOND)
    expect(audioUnits(0.004)).toBe(1)
  })
  it('estimates the length from bytes when the provider reports none', () => {
    expect(audioUnits(undefined, AUDIO_BYTES_PER_SECOND * 5)).toBe(5 * AUDIO_UNITS_PER_SECOND)
    expect(audioUnits(NaN, AUDIO_BYTES_PER_SECOND * 5)).toBe(5 * AUDIO_UNITS_PER_SECOND)
    expect(audioUnits(0, AUDIO_BYTES_PER_SECOND * 5)).toBe(5 * AUDIO_UNITS_PER_SECOND)
  })
})
