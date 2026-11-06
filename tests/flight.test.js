import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  calculateFlight,
  departureInstant,
  flightUrl,
  readFlightParams,
  sunAt,
} from '../utils/flight.js'
import { routePoint, distanceKm } from '../utils/geo.js'

const airports = JSON.parse(
  readFileSync(new URL('../assets/data/airports.json', import.meta.url), 'utf8'),
)
const airport = (code) => airports.find((item) => item.code === code)
const input = {
  from: airport('ICN'),
  to: airport('KIX'),
  date: '2026-11-07',
  time: '14:50',
  duration: 85,
}

test('reference flight ICN–KIX recommends the left side with sun on the right', () => {
  const flight = calculateFlight(input)
  assert.equal(flight.recommendation, 'left')
  assert.deepEqual(flight.percentages, { left: 0, right: 100, front: 0, night: 0 })
  assert.equal(flight.departure.toISOString(), '2026-11-07T05:50:00.000Z')
  assert.equal(flight.arrival.toISOString(), '2026-11-07T07:15:00.000Z')
})

test('all-night flight recommends either side', () => {
  const flight = calculateFlight({ ...input, time: '23:00' })
  assert.equal(flight.recommendation, 'either')
  assert.equal(flight.percentages.night, 100)
})

test('opposite direction changes the recommended side', () => {
  const flight = calculateFlight({ ...input, from: input.to, to: input.from })
  assert.equal(flight.recommendation, 'right')
})

test('summer and winter departures use the origin airport time zone', () => {
  assert.equal(
    departureInstant('2026-07-15', '12:00', 'America/New_York').toISOString(),
    '2026-07-15T16:00:00.000Z',
  )
  assert.equal(
    departureInstant('2026-12-15', '12:00', 'America/New_York').toISOString(),
    '2026-12-15T17:00:00.000Z',
  )
  assert.equal(
    departureInstant('2026-11-07', '12:00', 'Asia/Kolkata').toISOString(),
    '2026-11-07T06:30:00.000Z',
  )
})

test('skipped DST time is rejected and repeated hour uses earlier instant', () => {
  assert.throws(() => departureInstant('2026-03-08', '02:30', 'America/New_York'), /서머타임/)
  assert.equal(
    departureInstant('2026-11-01', '01:30', 'America/New_York').toISOString(),
    '2026-11-01T05:30:00.000Z',
  )
})

test('invalid calendar dates and malformed clock values are rejected', () => {
  for (const [date, time] of [
    ['2026-02-30', '12:00'],
    ['2026-13-01', '12:00'],
    ['2026-11-07', '25:00'],
    ['2026-11-07', '2:00'],
  ])
    assert.throws(() => departureInstant(date, time, 'Asia/Seoul'))
})

test('same airport and invalid durations are rejected', () => {
  assert.throws(() => calculateFlight({ ...input, to: input.from }), /다르게/)
  for (const duration of [0, 14, 1441, 85.5, NaN])
    assert.throws(() => calculateFlight({ ...input, duration }), /비행시간/)
})

test('share URL restores exactly the same result independent of host', () => {
  const original = calculateFlight(input)
  const url = flightUrl(original, 'https://example.com/flight-shade/?old=1#test')
  const params = readFlightParams(url)
  assert.deepEqual(params, {
    from: 'ICN',
    to: 'KIX',
    date: '2026-11-07',
    time: '14:50',
    duration: 85,
  })
  const restored = calculateFlight({
    ...params,
    from: airport(params.from),
    to: airport(params.to),
  })
  assert.deepEqual(restored.percentages, original.percentages)
  assert.equal(restored.recommendation, original.recommendation)
  assert.equal(restored.departure.getTime(), original.departure.getTime())
  assert.equal(new URL(url).pathname, '/flight-shade/')
  assert.equal(new URL(url).hash, '')
})

test('missing and malformed URL parameters are reported', () => {
  assert.equal(readFlightParams('https://example.com/'), null)
  assert.throws(() => readFlightParams('https://example.com/?from=ICN'), /빠져/)
  assert.throws(
    () =>
      readFlightParams(
        'https://example.com/?from=ICN&to=KIX&date=2026-11-07&time=14:50&duration=1.5',
      ),
    /비행시간/,
  )
})

test('Pacific route follows the date line rather than Europe', () => {
  const midpoint = routePoint(airport('NRT'), airport('LAX'), 0.5)
  assert.ok(Math.abs(midpoint.lon) > 150)
  assert.ok(midpoint.lat > 40)
  const flight = calculateFlight({
    ...input,
    from: airport('NRT'),
    to: airport('LAX'),
    time: '17:00',
    duration: 600,
  })
  assert.equal(
    Object.values(flight.percentages).reduce((a, b) => a + b, 0),
    100,
  )
  assert.ok(
    flight.samples.every(
      (sample) => Number.isFinite(sample.azimuth) && Number.isFinite(sample.heading),
    ),
  )
})

test('route endpoints and degenerate antipodal route remain finite', () => {
  assert.deepEqual(routePoint(input.from, input.to, 0), {
    lat: input.from.lat,
    lon: input.from.lon,
  })
  assert.deepEqual(routePoint(input.from, input.to, 1), { lat: input.to.lat, lon: input.to.lon })
  const midpoint = routePoint({ lat: 0, lon: 0 }, { lat: 0, lon: 180 }, 0.5)
  assert.ok(Number.isFinite(midpoint.lat) && Number.isFinite(midpoint.lon))
  assert.ok(distanceKm(input.from, input.to) > 800 && distanceKm(input.from, input.to) < 900)
})

test('long-haul percentages sum to 100 with mixed day and night', () => {
  for (const [from, to, time, duration] of [
    ['JFK', 'LHR', '20:00', 420],
    ['ICN', 'JFK', '10:00', 840],
    ['SYD', 'LAX', '22:00', 840],
  ]) {
    const flight = calculateFlight({
      ...input,
      from: airport(from),
      to: airport(to),
      time,
      duration,
    })
    assert.equal(
      Object.values(flight.percentages).reduce((a, b) => a + b, 0),
      100,
    )
    assert.ok(Object.values(flight.percentages).every((value) => value >= 0 && value <= 100))
  }
})

test('scrubbing changes the time and position while preserving flight bounds', () => {
  const flight = calculateFlight(input)
  const first = sunAt(input.from, input.to, flight.departure, input.duration, 0)
  const last = sunAt(input.from, input.to, flight.departure, input.duration, 1)
  assert.equal(first.instant.getTime(), flight.departure.getTime())
  assert.equal(last.instant.getTime(), flight.arrival.getTime())
  assert.equal(last.lat, input.to.lat)
})
