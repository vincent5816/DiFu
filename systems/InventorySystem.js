class InventorySystem {
  constructor(bag) {
    this.bag = bag;
  }

  add(item) {
    this.bag.items.push(item);
    this.bag.used += 1;
  }

  remove(itemId) {
    const itemIndex = this.bag.items.findIndex((item) => item.id === itemId);
    if (itemIndex < 0) {
      return null;
    }

    const removed = this.bag.items.splice(itemIndex, 1)[0];
    this.bag.used = Math.max(0, this.bag.used - 1);
    return removed;
  }

  isFull() {
    return this.bag.used >= this.bag.slots;
  }

  getItems() {
    return this.bag.items.slice();
  }

  getSnapshot(options = {}) {
    const includeHidden = Boolean(options.includeHidden);
    return {
      slots: this.bag.slots,
      used: this.bag.used,
      items: this.bag.items.map((item) => this.createItemSnapshot(item, includeHidden))
    };
  }

  createItemSnapshot(item, includeHidden = false) {
    const snapshot = {
      id: item.id,
      quality: item.quality,
      kind: item.kind || 'equipment',
      itemLevel: item.itemLevel || 1,
      slot: item.slot || null,
      qualityRank: this.getQualityRank(item.quality),
      identified: Boolean(item.identified),
      manualDesignRequired: Boolean(item.manualDesignRequired)
    };

    if (includeHidden || item.identified) {
      snapshot.baseId = item.baseId || null;
      snapshot.baseName = item.baseName || null;
      snapshot.baseTier = item.baseTier || null;
      snapshot.baseType = item.baseType || null;
      snapshot.baseStats = { ...(item.baseStats || {}) };
      snapshot.affixes = (item.affixes || []).map((affix) => ({
        id: affix.id,
        name: affix.name || affix.id,
        stat: affix.stat || null,
        tier: affix.tier,
        value: affix.value,
        valueType: affix.valueType || 'flat',
        epicPromoted: Boolean(affix.epicPromoted)
      }));
    }

    return snapshot;
  }

  selectDeathLosses(items) {
    const lossCount = Math.floor(items.length * 0.5);
    if (lossCount <= 0) {
      return [];
    }

    return [...items]
      .sort((a, b) => {
        return this.getQualityLossWeight(b.quality) - this.getQualityLossWeight(a.quality);
      })
      .slice(0, lossCount);
  }

  getQualityLossWeight(quality) {
    const weights = {
      normal: 5,
      magic: 4,
      rare: 3,
      epic: 2,
      legendary: 1
    };

    return weights[quality] || 5;
  }

  getQualityRank(quality) {
    const ranks = {
      normal: 1,
      magic: 2,
      rare: 3,
      epic: 4,
      legendary: 5
    };

    return ranks[quality] || 0;
  }
}

globalThis.InventorySystem = InventorySystem;
