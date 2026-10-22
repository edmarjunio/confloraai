// Local aggregates only: no URLs, customer data, tokens or telemetry requests.
export function startPerformanceMonitor() {
  const counters = {};
  const vitals = { lcp: null, inp: null, cls: 0, ttfb: null, catalogReady: null };
  const interactions = new Map();
  const observers = [];
  const perf = globalThis.performance;
  const observe = (type, processEntries, options = {}) => {
    try {
      const observer = new PerformanceObserver(list => processEntries(list.getEntries()));
      observer.observe({ type, buffered: true, ...options });
      observers.push(observer);
    } catch { /* Optional APIs vary by browser. */ }
  };
  observe('largest-contentful-paint', entries => { vitals.lcp = entries.at(-1)?.startTime ?? vitals.lcp; });
  // CLS uses the maximum session window, as in Core Web Vitals.
  let windowStart = 0, lastShift = 0, windowScore = 0;
  observe('layout-shift', entries => {
    for (const entry of entries) {
      if (entry.hadRecentInput) continue;
      if (entry.startTime - lastShift > 1000 || entry.startTime - windowStart > 5000) {
        windowStart = entry.startTime; windowScore = 0;
      }
      lastShift = entry.startTime;
      windowScore += entry.value;
      vitals.cls = Math.max(vitals.cls, windowScore);
    }
  });
  observe('event', entries => {
    for (const entry of entries) if (entry.interactionId) {
      interactions.set(entry.interactionId, Math.max(interactions.get(entry.interactionId) || 0, entry.duration));
    }
    const durations = [...interactions.values()].sort((a, b) => b - a);
    if (durations.length) vitals.inp = durations[Math.min(durations.length - 1, Math.floor((perf.interactionCount || durations.length) / 50))];
    // Keep the longest 200, bounding memory in long-running tabs.
    if (interactions.size > 200) {
      for (const [id] of [...interactions.entries()].sort((a, b) => b[1] - a[1]).slice(200)) interactions.delete(id);
    }
  }, { durationThreshold: 16 });
  const monitor = {
    count(name) { counters[name] = (counters[name] || 0) + 1; },
    markCatalogReady() { vitals.catalogReady = perf.now(); },
    snapshot() {
      const navigation = perf.getEntriesByType('navigation')[0];
      vitals.ttfb = navigation ? navigation.responseStart - navigation.startTime : null;
      const resources = perf.getEntriesByType('resource');
      return { vitals: { ...vitals }, counters: { ...counters }, resources: {
        requests: resources.length,
        transferredBytes: resources.reduce((sum, entry) => sum + entry.transferSize, 0),
        imageCount: resources.filter(entry => entry.initiatorType === 'img').length,
        imageDurationMs: resources.filter(entry => entry.initiatorType === 'img').reduce((sum, entry) => sum + entry.duration, 0),
      } };
    },
  };
  globalThis.ConfloraPerformance = monitor;
  return monitor;
}
