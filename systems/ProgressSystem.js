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

  static listCodexEntries() {
    return Object.values(ProgressSystem.getCodex());
  }
}

ProgressSystem.storageKey = 'hellSurvival.codex';

window.ProgressSystem = ProgressSystem;
