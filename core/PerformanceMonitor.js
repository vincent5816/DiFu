const PerformanceMonitor = {
  enabled: true,
  thresholdMs: 8,

  now() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
  },

  measure(label, context, callback) {
    if (typeof callback !== 'function') {
      return undefined;
    }

    if (!this.enabled) {
      return callback();
    }

    const startedAt = this.now();
    try {
      return callback();
    } finally {
      this.report(label, this.now() - startedAt, context);
    }
  },

  report(label, durationMs, context = {}) {
    if (!this.enabled || durationMs < this.thresholdMs) {
      return;
    }

    const payload = {
      label,
      durationMs: Math.round(durationMs * 10) / 10,
      ...context
    };
    console.warn('[Perf]', payload);
  }
};

globalThis.PerformanceMonitor = PerformanceMonitor;
