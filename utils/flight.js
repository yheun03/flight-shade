import SunCalc from 'suncalc'
import { bearingDegrees, normalizeDegrees, routePoint, distanceKm } from './geo.js'

function localParts(date, timeZone) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
}

// Resolve the airport's IANA zone, independent of the visitor's computer time zone.
// Repeated DST hours use the earlier occurrence; skipped local hours are rejected.
export function departureInstant(date, time, timeZone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
    throw new Error('출발 날짜와 시간을 확인해 주세요.')
  const requested = `${date}T${time}`
  const wall = new Date(`${requested}:00Z`)
  if (!Number.isFinite(wall.getTime()) || wall.toISOString().slice(0, 16) !== requested)
    throw new Error('올바른 출발 날짜와 시간을 입력해 주세요.')
  const offsets = new Set()
  for (const hours of [-36, -12, 0, 12, 36]) {
    const instant = new Date(wall.getTime() + hours * 3600000)
    const p = localParts(instant, timeZone)
    offsets.add(
      new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`).getTime() -
        instant.getTime(),
    )
  }
  const matches = [...offsets]
    .map((offset) => new Date(wall.getTime() - offset))
    .filter((instant) => {
      const p = localParts(instant, timeZone)
      return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}` === requested
    })
    .sort((a, b) => a - b)
  if (!matches.length)
    throw new Error(
      '이 시간은 현지 서머타임 전환으로 존재하지 않습니다. 다른 시간을 선택해 주세요.',
    )
  return matches[0]
}

export function sunAt(from, to, departure, duration, fraction) {
  const position = routePoint(from, to, fraction)
  const before = routePoint(from, to, Math.max(0, fraction - 0.0001))
  const after = routePoint(from, to, Math.min(1, fraction + 0.0001))
  const heading = bearingDegrees(before, after)
  const instant = new Date(departure.getTime() + duration * 60000 * fraction)
  const sun = SunCalc.getPosition(instant, position.lat, position.lon)
  const azimuth = normalizeDegrees((sun.azimuth * 180) / Math.PI + 180)
  const elevation = (sun.altitude * 180) / Math.PI
  const relative = normalizeDegrees(azimuth - heading)
  const altitude = 10668 * Math.min(1, fraction / 0.15, (1 - fraction) / 0.15)
  const horizon = -0.833 - (Math.acos(6371000 / (6371000 + Math.max(0, altitude))) * 180) / Math.PI
  let side = 'night'
  if (elevation > horizon) {
    side =
      Math.abs(Math.sin((relative * Math.PI) / 180)) < Math.sin((15 * Math.PI) / 180)
        ? 'front'
        : relative < 180
          ? 'right'
          : 'left'
  }
  return { ...position, fraction, instant, heading, azimuth, elevation, relative, side }
}

export function calculateFlight({ from, to, date, time, duration }) {
  if (from.code === to.code || distanceKm(from, to) < 1)
    throw new Error('출발 공항과 도착 공항을 다르게 선택해 주세요.')
  if (!Number.isInteger(duration) || duration < 15 || duration > 1440)
    throw new Error('비행시간은 15분에서 24시간 사이로 입력해 주세요.')
  const departure = departureInstant(date, time, from.tz)
  const samples = Array.from({ length: 240 }, (_, i) =>
    sunAt(from, to, departure, duration, (i + 0.5) / 240),
  )
  const counts = { left: 0, right: 0, front: 0, night: 0 }
  samples.forEach(({ side }) => counts[side]++)
  const percentages = Object.fromEntries(
    Object.entries(counts).map(([key, count]) => [key, Math.floor((count / samples.length) * 100)]),
  )
  const remainders = Object.keys(counts).sort(
    (a, b) => ((counts[b] / 2.4) % 1) - ((counts[a] / 2.4) % 1),
  )
  let remaining = 100 - Object.values(percentages).reduce((sum, v) => sum + v, 0)
  for (const key of remainders) {
    if (remaining-- > 0) percentages[key]++
  }
  const recommendation =
    Math.abs(counts.left - counts.right) < samples.length * 0.02
      ? 'either'
      : counts.left < counts.right
        ? 'left'
        : 'right'
  return {
    from,
    to,
    date,
    time,
    duration,
    departure,
    samples,
    percentages,
    recommendation,
    arrival: new Date(departure.getTime() + duration * 60000),
    distance: Math.round(distanceKm(from, to)),
  }
}

export function flightUrl(flight, currentUrl) {
  const url = new URL(currentUrl)
  url.search = new URLSearchParams({
    from: flight.from.code,
    to: flight.to.code,
    date: flight.date,
    time: flight.time,
    duration: String(flight.duration),
  }).toString()
  url.hash = ''
  return url.href
}

export function readFlightParams(currentUrl) {
  const url = new URL(currentUrl)
  const keys = ['from', 'to', 'date', 'time', 'duration']
  if (!keys.some((key) => url.searchParams.has(key))) return null
  if (!keys.every((key) => url.searchParams.get(key)))
    throw new Error('공유 주소에 항공편 정보가 빠져 있습니다. 아래에서 다시 입력해 주세요.')
  const duration = url.searchParams.get('duration')
  if (!/^\d+$/.test(duration)) throw new Error('공유 주소의 비행시간이 올바르지 않습니다.')
  return {
    from: url.searchParams.get('from').toUpperCase(),
    to: url.searchParams.get('to').toUpperCase(),
    date: url.searchParams.get('date'),
    time: url.searchParams.get('time'),
    duration: Number(duration),
  }
}

export function formatTime(date, timeZone) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function formatDuration(minutes) {
  return `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ''}`
}
