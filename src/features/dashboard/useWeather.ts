import { useEffect, useState } from 'react'

export interface Weather {
  temp: number
  high: number
  low: number
  code: number
  label: string
  nextRainDay: string | null
}

const LABELS: Record<number, string> = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Foggy', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Showers', 81: 'Showers', 82: 'Heavy showers', 85: 'Snow showers', 86: 'Snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
}

/** Open-Meteo (no key). Refreshes every 30 minutes. */
export function useWeather(lat: number, lon: number) {
  const [weather, setWeather] = useState<Weather | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7`
        const r = await fetch(url)
        const j = await r.json()
        const rainIdx = (j.daily.precipitation_probability_max as number[]).findIndex((p, i) => i > 0 && p >= 60)
        const nextRainDay = rainIdx > 0 ? new Date(j.daily.time[rainIdx]).toLocaleDateString('en-GB', { weekday: 'long' }) : null
        if (!cancelled) setWeather({
          temp: Math.round(j.current.temperature_2m),
          high: Math.round(j.daily.temperature_2m_max[0]),
          low: Math.round(j.daily.temperature_2m_min[0]),
          code: j.current.weather_code,
          label: LABELS[j.current.weather_code] ?? 'Changeable',
          nextRainDay,
        })
      } catch { /* keep the last reading; offline is fine */ }
    }
    void load()
    const id = setInterval(() => void load(), 30 * 60 * 1000)
    return () => { cancelled = true; clearInterval(id) }
  }, [lat, lon])

  return weather
}
