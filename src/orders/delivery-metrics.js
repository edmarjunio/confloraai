const { randomUUID } = require('node:crypto');

const DELIVERY_LABELS = {
  PENDING_DELIVERY: 'Aguardando entregador', PENDING_DISPATCH: 'Aguardando liberação',
  PREPARING_DELIVERY: 'Em separação', OUT_FOR_DELIVERY: 'Em rota', DELIVERED: 'Finalizado / entregue',
};
function elapsedSeconds(start, end) {
  const milliseconds = Date.parse(end) - Date.parse(start);
  return Number.isFinite(milliseconds) && milliseconds >= 0 ? Math.floor(milliseconds / 1000) : null;
}
function recordDeliveryEvent(tx, order, status, actor, now, details = {}) {
  const event = { id: randomUUID(), orderId: order.id, status, label: DELIVERY_LABELS[status], actor, createdAt: now, ...details };
  tx.set('delivery_events', event.id, event);
  return [...(order.deliveryHistory || []).slice(-49), event];
}
function completionMetrics(order, now, actualDistanceKm) {
  const actual = actualDistanceKm !== undefined && actualDistanceKm !== null && actualDistanceKm !== '' ? Number(actualDistanceKm) : null;
  if (actual !== null && (!Number.isFinite(actual) || actual <= 0 || actual > 10000)) throw new Error('Informe uma distância percorrida válida, maior que zero e até 10.000 km.');
  const estimated = Number(order.deliveryRoute?.distanceMeters) / 1000;
  const distanceKm = actual ?? (estimated > 0 ? estimated : null);
  const departure = order.departedAt || order.acceptedAt || null;
  const durationSeconds = elapsedSeconds(departure, now);
  return { departure, departureIsLegacy: !order.departedAt, durationSeconds,
    preparationSeconds: elapsedSeconds(order.acceptedAt, order.departedAt),
    distanceKm, distanceSource: actual !== null ? 'DECLARED_ACTUAL' : distanceKm ? 'GOOGLE_ROUTE_ESTIMATE' : 'UNAVAILABLE',
    minutesPerKm: durationSeconds !== null && distanceKm ? durationSeconds / 60 / distanceKm : null, recordedAt: now };
}
function driverPerformance(orders) {
  const groups = new Map();
  for (const order of orders) {
    const driver = order.assignedDriver || order.deliveredBy;
    if (!driver?.id) continue;
    if (!groups.has(driver.id)) groups.set(driver.id, { driver, deliveries: 0, timedDeliveries: 0, durationSeconds: 0, actualKm: 0, actualSeconds: 0, actualSamples: 0, estimatedKm: 0, estimatedSeconds: 0, estimatedSamples: 0 });
    const row = groups.get(driver.id); row.deliveries++;
    const metric = order.deliveryMetrics || completionMetrics(order, order.deliveredAt);
    if (metric.durationSeconds === null || metric.departureIsLegacy) continue;
    row.timedDeliveries++; row.durationSeconds += metric.durationSeconds;
    if (!(metric.distanceKm > 0)) continue;
    const type = metric.distanceSource === 'DECLARED_ACTUAL' ? 'actual' : 'estimated';
    row[type + 'Km'] += metric.distanceKm; row[type + 'Seconds'] += metric.durationSeconds; row[type + 'Samples']++;
  }
  return [...groups.values()].map(row => ({ ...row, averageMinutes: row.timedDeliveries ? row.durationSeconds / 60 / row.timedDeliveries : null,
    actualMinutesPerKm: row.actualKm ? row.actualSeconds / 60 / row.actualKm : null,
    estimatedMinutesPerKm: row.estimatedKm ? row.estimatedSeconds / 60 / row.estimatedKm : null }));
}
function mergeDriverPerformance(previous, order, now) {
  const next = driverPerformance([order])[0];
  if (!next) throw new Error('Entregador não identificado para registrar a conclusão.');
  const fields = ['deliveries', 'timedDeliveries', 'durationSeconds', 'actualKm', 'actualSeconds', 'actualSamples', 'estimatedKm', 'estimatedSeconds', 'estimatedSamples'];
  for (const field of fields) next[field] += Number(previous?.[field] || 0);
  return { ...next, scope: 'ALL_TIME', recordedSince: previous?.recordedSince || now, updatedAt: now,
    averageMinutes: next.timedDeliveries ? next.durationSeconds / 60 / next.timedDeliveries : null,
    actualMinutesPerKm: next.actualKm ? next.actualSeconds / 60 / next.actualKm : null,
    estimatedMinutesPerKm: next.estimatedKm ? next.estimatedSeconds / 60 / next.estimatedKm : null };
}
module.exports = { mergeDriverPerformance, DELIVERY_LABELS, elapsedSeconds, recordDeliveryEvent, completionMetrics, driverPerformance };
