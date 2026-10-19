const test = require('node:test');
const assert = require('node:assert/strict');
const { completionMetrics, driverPerformance, mergeDriverPerformance } = require('../src/orders/delivery-metrics');
const driver = { id: 'driver', name: 'Entregador' };
const order = { assignedDriver: driver, acceptedAt: '2026-10-17T10:00:00Z', departedAt: '2026-10-17T10:05:00Z', deliveredAt: '2026-10-17T10:25:00Z', deliveryRoute: { distanceMeters: 4000 } };
test('delivery separates preparation from route time and labels actual and estimated km', () => {
  const estimated = completionMetrics(order, order.deliveredAt);
  assert.equal(estimated.preparationSeconds, 300); assert.equal(estimated.durationSeconds, 1200);
  assert.equal(estimated.distanceKm, 4); assert.equal(estimated.minutesPerKm, 5);
  assert.equal(estimated.distanceSource, 'GOOGLE_ROUTE_ESTIMATE');
  const actual = completionMetrics(order, order.deliveredAt, 5);
  assert.equal(actual.distanceKm, 5); assert.equal(actual.minutesPerKm, 4);
  assert.equal(actual.distanceSource, 'DECLARED_ACTUAL');
  for (const invalid of [-1, 0, 10001, 'abc', Infinity]) assert.throws(() => completionMetrics(order, order.deliveredAt, invalid), /distância/);
});
test('weighted averages separate estimates from actual km and attribute Admin completions to assigned driver', () => {
  const actual = { ...order, deliveredBy: { id: 'admin' }, deliveryMetrics: completionMetrics(order, order.deliveredAt, 5) };
  const other = { ...order, deliveredAt: '2026-10-17T10:45:00Z', deliveryMetrics: completionMetrics(order, '2026-10-17T10:45:00Z', 15) };
  const estimated = { ...order, deliveryMetrics: completionMetrics(order, order.deliveredAt) };
  const [row] = driverPerformance([actual, other, estimated]);
  assert.equal(row.driver.id, 'driver'); assert.equal(row.deliveries, 3);
  assert.equal(row.actualMinutesPerKm, 3); assert.equal(row.estimatedMinutesPerKm, 5);
  const first = mergeDriverPerformance(null, actual, order.deliveredAt);
  const merged = mergeDriverPerformance(first, other, other.deliveredAt);
  assert.equal(merged.deliveries, 2); assert.equal(merged.actualMinutesPerKm, 3);
  assert.equal(merged.recordedSince, first.recordedSince);
});
test('unknown distance and legacy acceptance times never manufacture km or timed averages', () => {
  const legacy = { ...order, departedAt: undefined, deliveryRoute: null };
  const metrics = completionMetrics(legacy, order.deliveredAt);
  assert.equal(metrics.distanceKm, null); assert.equal(metrics.minutesPerKm, null); assert.equal(metrics.departureIsLegacy, true);
  const [row] = driverPerformance([legacy]);
  assert.equal(row.deliveries, 1); assert.equal(row.averageMinutes, null);
});
