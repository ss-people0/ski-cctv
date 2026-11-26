import { expect, test } from 'vitest'
import { resorts } from './cams'
import { contrastRatio, mixHex, themeOf, themes } from './themes'

test('every resort on the page has a theme', () => {
  for (const resort of resorts) expect(themes[resort.id], resort.id).toBeDefined()
})

test('every theme text color reaches 4.5:1 contrast on its background', () => {
  for (const [id, theme] of Object.entries(themes)) {
    expect(contrastRatio(theme.background, theme.foreground), id).toBeGreaterThanOrEqual(4.5)
  }
})

test('contrastRatio matches known black/white value', () => {
  expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
})

test('mixHex blends two colors by ratio', () => {
  expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080')
  expect(mixHex('#A4CFF2', '#FFFFFF', 0)).toBe('#A4CFF2')
})

test('unknown resort falls back to a default theme', () => {
  expect(themeOf('nope')).toEqual(themes.yongpyong)
})
