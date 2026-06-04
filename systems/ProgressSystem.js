class ProgressSystem {
  static getCodex() {
    try {
      return JSON.parse(localStorage.getItem(ProgressSystem.storageKey) || '{}');
    } catch (error) {
      console.warn('[ProgressSystem] Failed to read codex, resetting.', error);
      return {};
    }
  }

  static unlockCodex(type) {
    const codex = ProgressSystem.getCodex();
    if (codex[type]) {
      return false;
    }

    codex[type] = {
      type,
      unlockedAt: new Date().toISOString()
    };
    localStorage.setItem(ProgressSystem.storageKey, JSON.stringify(codex));
    return true;
  }

  static recordObservedEvent(type, eventType, details = {}) {
    if (!type || !eventType) {
      return;
    }

    const codex = ProgressSystem.getCodex();
    const entry = codex[type] || {
      type,
      unlockedAt: new Date().toISOString()
    };
    const observedEvents = entry.observedEvents || {};
    const current = observedEvents[eventType] || {
      type: eventType,
      count: 0,
      firstSeenAt: new Date().toISOString()
    };
    current.count += 1;
    current.lastSeenAt = new Date().toISOString();
    if (details.burstCount) {
      current.burstCount = details.burstCount;
    }
    observedEvents[eventType] = current;
    entry.observedEvents = observedEvents;
    codex[type] = entry;
    localStorage.setItem(ProgressSystem.storageKey, JSON.stringify(codex));
  }

  static listCodexEntries() {
    return Object.values(ProgressSystem.getCodex());
  }
}

ProgressSystem.storageKey = 'hellSurvival.codex';

window.ProgressSystem = ProgressSystem;
