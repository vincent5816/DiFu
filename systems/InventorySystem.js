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

  getSnapshot() {
    return {
      slots: this.bag.slots,
      used: this.bag.used,
      items: this.bag.items.map((item) => ({
        id: item.id,
        quality: item.quality
      }))
    };
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
}

globalThis.InventorySystem = InventorySystem;
