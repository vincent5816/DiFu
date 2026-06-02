class StorageSystem {
  static getItems() {
    try {
      return JSON.parse(localStorage.getItem(StorageSystem.storageKey) || '[]');
    } catch (error) {
      console.warn('[StorageSystem] Failed to read storage, resetting.', error);
      return [];
    }
  }

  static identifyAndStore(unidentifiedItems) {
    const existingItems = StorageSystem.getItems();
    const identifiedItems = unidentifiedItems.map((item) => StorageSystem.identify(item));
    const nextItems = existingItems.concat(identifiedItems);

    localStorage.setItem(StorageSystem.storageKey, JSON.stringify(nextItems));
    return identifiedItems;
  }

  static identify(item) {
    return {
      id: `identified_${item.id}`,
      sourceId: item.id,
      quality: item.quality,
      slot: 'weapon',
      affixes: [
        {
          type: 'attack_power',
          tier: item.quality === 'rare' ? 3 : 2
        }
      ],
      locked: false
    };
  }
}

StorageSystem.storageKey = 'hellSurvival.storage';

globalThis.StorageSystem = StorageSystem;
