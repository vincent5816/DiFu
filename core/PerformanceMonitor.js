const PerformanceMonitor = {
  enabled: true,
  thresholdMs: 8,
  debugLogsEnabled: false,
  frameHitchThresholdMs: 40,
  lastFrameHitchAt: -Infinity,
  frameHitchCooldownMs: 500,

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
  },

  reportFrame(deltaMs, context = {}) {
    if (!this.enabled || deltaMs < this.frameHitchThresholdMs) {
      return;
    }

    const now = this.now();
    if (now - this.lastFrameHitchAt < this.frameHitchCooldownMs) {
      return;
    }

    this.lastFrameHitchAt = now;
    console.warn('[FrameHitch]', {
      deltaMs: Math.round(deltaMs * 10) / 10,
      thresholdMs: this.frameHitchThresholdMs,
      ...context
    });
  },

  debugLog(...args) {
    if (!this.debugLogsEnabled) {
      return;
    }

    console.log(...args);
  }
};

globalThis.PerformanceMonitor = PerformanceMonitor;
