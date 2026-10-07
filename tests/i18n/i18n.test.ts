import { describe, expect, it } from 'vitest'
import de from '@/i18n/de.json'
import en from '@/i18n/en.json'
import { detectLanguage } from '@/i18n'

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
}

function values(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  return Object.values(value as object).flatMap(values)
}

describe('translations', () => {
  it('have the same keys in English and German', () => {
    expect(keys(de).sort()).toEqual(keys(en).sort())
  })

  it('have no empty strings', () => {
    for (const text of [...values(en), ...values(de)]) expect(text.trim()).not.toBe('')
  })
})

describe('detectLanguage', () => {
  it('prefers a saved choice', () => {
    expect(detectLanguage('de', 'en-US')).toBe('de')
    expect(detectLanguage('en', 'de-DE')).toBe('en')
  })

  it('falls back to the browser language, then English', () => {
    expect(detectLanguage(null, 'de-AT')).toBe('de')
    expect(detectLanguage(null, 'fr-FR')).toBe('en')
    expect(detectLanguage('xx', undefined)).toBe('en')
  })
})
