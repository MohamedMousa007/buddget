import { describe, it, expect } from 'vitest'
import { merchantCategoryKey, catalogCategory } from '../merchantCategoryCache'

describe('merchantCategoryKey', () => {
  it('folds to lowercase alphanumeric — identical to the SQL key', () => {
    // Must equal Postgres regexp_replace(lower(x),'[^a-z0-9]','','g').
    expect(merchantCategoryKey('TALABAT')).toBe('talabat')
    expect(merchantCategoryKey('Talabat*123')).toBe('talabat123')
    expect(merchantCategoryKey('APPLE.COM BILL')).toBe('applecombill')
    expect(merchantCategoryKey('EL Wahat for oi')).toBe('elwahatforoi')
  })

  it('rejects too-short and non-latin keys (they skip the cache)', () => {
    expect(merchantCategoryKey('AB')).toBeNull()
    expect(merchantCategoryKey('فودافون كاش')).toBeNull() // Arabic folds to '' → null
    expect(merchantCategoryKey(null)).toBeNull()
    expect(merchantCategoryKey('')).toBeNull()
  })
})

describe('catalogCategory', () => {
  it('resolves known subscription brands to their default category', () => {
    expect(catalogCategory('Netflix.com')).toBe('Enjoyment')
    expect(catalogCategory('OSN+')).toBe('Enjoyment')
    expect(catalogCategory('Spotify')).toBe('Enjoyment')
  })

  it('returns null for unknown merchants and for brands whose default is Other', () => {
    expect(catalogCategory('Kashier Gec Cen')).toBeNull()
    expect(catalogCategory('Some Random Shop')).toBeNull()
    expect(catalogCategory(null)).toBeNull()
  })
})
