class SettlementSystem {
  constructor(scene) {
    this.scene = scene;
  }

  createRunSummary(result) {
    const bagSnapshot = this.scene.inventorySystem.getSnapshot();
    const items = bagSnapshot.items;
    const lostItems = result === 'death' ? this.scene.inventorySystem.selectDeathLosses(items) : [];
    const lostIds = new Set(lostItems.map((item) => item.id));
    const keptItems = result === 'death' ? items.filter((item) => !lostIds.has(item.id)) : items;

    const summary = {
      result,
      codeVersion: window.HELL_SURVIVAL_CODE_VERSION || null,
      floor: this.scene.currentFloor,
      roomId: this.scene.currentRoomId,
      hp: Math.ceil(this.scene.player.hp),
      maxHp: this.scene.player.maxHp,
      gold: this.scene.player.gold,
      bag: {
        slots: bagSnapshot.slots,
        used: keptItems.length,
        items: keptItems
      },
      lostItems,
      newCodexEntries: this.scene.newCodexEntries.map((entry) => ({
        type: entry.type
      })),
      events: this.scene.runRecorder.getSnapshot()
    };

    summary.agentReplayIndex = AgentReplayIndex.create(summary);
    summary.developerRunLog = AgentReplayIndex.createDeveloperLog(summary);
    return summary;
  }
}

globalThis.SettlementSystem = SettlementSystem;
