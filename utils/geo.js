const radians = (degrees) => (degrees * Math.PI) / 180
const degrees = (radians) => (radians * 180) / Math.PI

export const normalizeDegrees = (value) => ((value % 360) + 360) % 360

export function distanceKm(from, to) {
  const latitude = radians(to.lat - from.lat)
  const longitude = radians(to.lon - from.lon)
  const a =
    Math.sin(latitude / 2) ** 2 +
    Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(longitude / 2) ** 2
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))))
}

export function bearingDegrees(from, to) {
  const longitude = radians(to.lon - from.lon)
  const y = Math.sin(longitude) * Math.cos(radians(to.lat))
  const x =
    Math.cos(radians(from.lat)) * Math.sin(radians(to.lat)) -
    Math.sin(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.cos(longitude)
  return normalizeDegrees(degrees(Math.atan2(y, x)))
}

// Spherical interpolation follows the shorter great-circle route, including the date line.
export function routePoint(from, to, fraction) {
  if (fraction <= 0) return { lat: from.lat, lon: from.lon }
  if (fraction >= 1) return { lat: to.lat, lon: to.lon }
  const vector = ({ lat, lon }) => [
    Math.cos(radians(lat)) * Math.cos(radians(lon)),
    Math.cos(radians(lat)) * Math.sin(radians(lon)),
    Math.sin(radians(lat)),
  ]
  const start = vector(from)
  const end = vector(to)
  const dot = Math.min(
    1,
    Math.max(
      -1,
      start.reduce((sum, v, i) => sum + v * end[i], 0),
    ),
  )
  const angle = Math.acos(dot)
  if (angle < 1e-8) return { lat: from.lat, lon: from.lon }
  let tangent = end.map((v, i) => v - dot * start[i])
  let length = Math.hypot(...tangent)
  if (length < 1e-8) {
    tangent = [-start[1], start[0], 0]
    length = Math.hypot(...tangent)
    if (length < 1e-8) {
      tangent = [1, 0, 0]
      length = 1
    }
  }
  const point = start.map(
    (v, i) => v * Math.cos(angle * fraction) + (tangent[i] / length) * Math.sin(angle * fraction),
  )
  return {
    lat: degrees(Math.atan2(point[2], Math.hypot(point[0], point[1]))),
    lon: degrees(Math.atan2(point[1], point[0])),
  }
}

export function estimateDuration(from, to) {
  return Math.max(35, Math.round(((distanceKm(from, to) / 780) * 60 + 20) / 5) * 5)
}
