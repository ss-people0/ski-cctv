// Open-Meteo로 각 스키장 위치의 현재 날씨를 받아온다. 키 불필요, 비상업 무료.
// 데이터 라이선스 CC BY 4.0 → 화면에 "날씨: Open-Meteo" 표기.

export interface Weather {
  temp: number // 섭씨 (반올림)
  icon: string // 이모지
  label: string // 한국어 설명
}

// WMO weather code → 아이콘/설명. (낮/밤 구분은 맑음 계열만)
function describe(code: number, isDay: boolean): { icon: string; label: string } {
  if (code === 0) return isDay ? { icon: '☀️', label: '맑음' } : { icon: '🌙', label: '맑음' }
  if (code === 1 || code === 2) return { icon: isDay ? '🌤️' : '☁️', label: '구름 조금' }
  if (code === 3) return { icon: '☁️', label: '흐림' }
  if (code === 45 || code === 48) return { icon: '🌫️', label: '안개' }
  if (code >= 51 && code <= 57) return { icon: '🌦️', label: '이슬비' }
  if (code >= 61 && code <= 67) return { icon: '🌧️', label: '비' }
  if (code >= 71 && code <= 77) return { icon: '❄️', label: '눈' }
  if (code >= 80 && code <= 82) return { icon: '🌦️', label: '소나기' }
  if (code === 85 || code === 86) return { icon: '🌨️', label: '눈' }
  if (code >= 95) return { icon: '⛈️', label: '뇌우' }
  return { icon: '🌡️', label: '날씨' }
}

export function weatherFrom(code: number, temp: number, isDay: boolean): Weather {
  const d = describe(code, isDay)
  return { temp: Math.round(temp), icon: d.icon, label: d.label }
}

// 실패하거나 fetch가 없으면 null → 날씨 칩만 안 보이고 페이지는 그대로.
export async function fetchWeather(lat: number, lon: number): Promise<Weather | null> {
  if (typeof fetch !== 'function') return null
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weather_code,is_day&timezone=Asia%2FSeoul`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number; is_day?: number }
    }
    const c = data.current
    if (!c || typeof c.temperature_2m !== 'number' || typeof c.weather_code !== 'number') return null
    return weatherFrom(c.weather_code, c.temperature_2m, c.is_day === 1)
  } catch {
    return null
  }
}
