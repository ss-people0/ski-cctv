import { expect, test } from 'vitest'
import { weatherFrom } from './weather'
import { resorts } from './cams'

test('clear sky shows sun by day and moon by night, temperature rounded', () => {
  expect(weatherFrom(0, 2.6, true)).toEqual({ temp: 3, icon: '☀️', label: '맑음' })
  expect(weatherFrom(0, -3.4, false)).toEqual({ temp: -3, icon: '🌙', label: '맑음' })
})

test('snow codes map to a snow icon', () => {
  expect(weatherFrom(71, -5, true).icon).toBe('❄️')
  expect(weatherFrom(85, -5, true).label).toBe('눈')
})

test('overcast and rain map correctly', () => {
  expect(weatherFrom(3, 1, true)).toMatchObject({ icon: '☁️', label: '흐림' })
  expect(weatherFrom(63, 4, true).icon).toBe('🌧️')
})

test('every resort has coordinates for weather lookup', () => {
  resorts.forEach((resort) => {
    expect(resort.coord, resort.id).toBeTruthy()
    expect(resort.coord!.lat).toBeGreaterThan(33)
    expect(resort.coord!.lat).toBeLessThan(39)
  })
})
