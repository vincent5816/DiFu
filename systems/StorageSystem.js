class StorageSystem {
  static getItems() {
    StorageSystem.clearAllEquipmentOnce();
    const rawItems = StorageSystem.getRawItems();
    const validItems = rawItems
      .filter((item) => StorageSystem.isCurrentRuleItem(item))
      .map((item) => StorageSystem.normalizeStoredItem(item));
    const items = StorageSystem.dedupeItemsByIdKeepLast(validItems);

    if (items.length !== rawItems.length || items.length !== validItems.length) {
      StorageSystem.saveItems(items);
    }

    return items;
  }

  static saveItems(items) {
    localStorage.setItem(StorageSystem.storageKey, JSON.stringify(items || []));
  }

  static getEquipped() {
    StorageSystem.clearAllEquipmentOnce();
    const equipped = StorageSystem.getRawEquipped();
    let changed = false;
    const normalized = Object.entries(equipped).reduce((result, [slot, item]) => {
      if (
        StorageSystem.isValidSlot(slot) &&
        StorageSystem.isCurrentRuleItem(item) &&
        item.slot === slot
      ) {
        result[slot] = StorageSystem.normalizeStoredItem(item);
        return result;
      }

      changed = true;
      return result;
    }, {});

    if (changed) {
      StorageSystem.saveEquipped(normalized);
    }

    return normalized;
  }

  static saveEquipped(equipped) {
    localStorage.setItem(StorageSystem.equippedKey, JSON.stringify(equipped || {}));
  }

  static getBuildConfig() {
    const fallback = {
      activeSkillId: PlayerData.activeSkillId || (globalThis.SkillsData && SkillsData.defaultActiveSkillId) || null,
      supportSkillIds: StorageSystem.normalizeSupportSkillSlots(PlayerData.supportSkillIds || [])
    };
    try {
      const raw = JSON.parse(localStorage.getItem(StorageSystem.buildKey) || 'null');
      if (!raw) {
        return fallback;
      }
      return StorageSystem.normalizeBuildConfig(raw);
    } catch (error) {
      console.warn('[StorageSystem] Failed to read build config, resetting.', error);
      return fallback;
    }
  }

  static saveBuildConfig(config) {
    const normalized = StorageSystem.normalizeBuildConfig(config);
    localStorage.setItem(StorageSystem.buildKey, JSON.stringify(normalized));
    return normalized;
  }

  static normalizeBuildConfig(config = {}) {
    const activeIds = globalThis.SkillsData ? SkillsData.activeSkillIds || [] : [];
    const supportIds = globalThis.SkillsData ? SkillsData.supportSkillIds || [] : [];
    const fallbackActive = PlayerData.activeSkillId || (activeIds[0] || null);
    const activeSkillId = activeIds.includes(config.activeSkillId)
      ? config.activeSkillId
      : fallbackActive;
    const selectedSupportIds = Array.isArray(config.supportSkillIds)
      ? config.supportSkillIds
      : PlayerData.supportSkillIds || [];

    return {
      activeSkillId,
      supportSkillIds: StorageSystem.normalizeSupportSkillSlots(selectedSupportIds, supportIds)
    };
  }

  static normalizeSupportSkillSlots(skillIds = [], validSkillIds = null) {
    const supportIds = validSkillIds || (globalThis.SkillsData ? SkillsData.supportSkillIds || [] : []);
    const used = new Set();
    return [0, 1].map((index) => {
      const skillId = skillIds[index] || null;
      if (!skillId || !supportIds.includes(skillId) || used.has(skillId)) {
        return null;
      }
      used.add(skillId);
      return skillId;
    });
  }

  static clearInvalidCurrentRuleData() {
    StorageSystem.clearAllEquipmentOnce();
    const rawItems = StorageSystem.getRawItems();
    const validItems = rawItems
      .filter((item) => StorageSystem.isCurrentRuleItem(item))
      .map((item) => StorageSystem.normalizeStoredItem(item));
    const items = StorageSystem.dedupeItemsByIdKeepLast(validItems);
    const itemById = new Map(items.map((item) => [item.id, item]));
    const rawEquipped = StorageSystem.getRawEquipped();
    const equipped = Object.entries(rawEquipped).reduce((result, [slot, item]) => {
      if (
        StorageSystem.isValidSlot(slot) &&
        StorageSystem.isCurrentRuleItem(item) &&
        item.slot === slot &&
        itemById.has(item.id) &&
        itemById.get(item.id).slot === item.slot
      ) {
        result[slot] = StorageSystem.normalizeStoredItem(itemById.get(item.id));
      }
      return result;
    }, {});

    StorageSystem.saveItems(items);
    StorageSystem.saveEquipped(equipped);

    return {
      removedItems: rawItems.length - items.length,
      removedEquipped: Object.keys(rawEquipped).length - Object.keys(equipped).length
    };
  }

  static dedupeItemsByIdKeepLast(items) {
    const seen = new Set();
    const keptReversed = [];
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      if (!item || seen.has(item.id)) {
        continue;
      }
      seen.add(item.id);
      keptReversed.push(item);
    }
    return keptReversed.reverse();
  }

  static clearAllEquipmentOnce() {
    const version = 'equipment_bases_v1';
    if (localStorage.getItem(StorageSystem.equipmentPurgeKey) === version) {
      return false;
    }

    StorageSystem.clearAllEquipment();
    localStorage.setItem(StorageSystem.equipmentPurgeKey, version);
    return true;
  }

  static clearAllEquipment() {
    StorageSystem.saveItems([]);
    StorageSystem.saveEquipped({});
  }

  static getRawItems() {
    try {
      return JSON.parse(localStorage.getItem(StorageSystem.storageKey) || '[]');
    } catch (error) {
      console.warn('[StorageSystem] Failed to read storage, resetting.', error);
      return [];
    }
  }

  static getRawEquipped() {
    try {
      return JSON.parse(localStorage.getItem(StorageSystem.equippedKey) || '{}');
    } catch (error) {
      console.warn('[StorageSystem] Failed to read equipped items, resetting.', error);
      return {};
    }
  }

  static identifyAndStore(unidentifiedItems) {
    const existingItems = StorageSystem.getItems();
    const batchId = StorageSystem.createBatchId();
    const identifiedItems = unidentifiedItems
      .map((item, index) => StorageSystem.identify(item, batchId, index))
      .filter((item) => StorageSystem.isCurrentRuleItem(item));
    const nextItems = existingItems.concat(identifiedItems);

    StorageSystem.saveItems(nextItems);
    return identifiedItems;
  }

  static equipItem(itemId) {
    const items = StorageSystem.getItems();
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item || !StorageSystem.isCurrentRuleItem(item)) {
      return {
        ok: false,
        reason: 'not_equippable'
      };
    }

    const equipped = StorageSystem.getEquipped();
    equipped[item.slot] = StorageSystem.normalizeStoredItem(item);
    StorageSystem.saveEquipped(equipped);
    return {
      ok: true,
      equipped
    };
  }

  static unequipSlot(slot) {
    const equipped = StorageSystem.getEquipped();
    if (equipped[slot]) {
      delete equipped[slot];
      StorageSystem.saveEquipped(equipped);
    }
    return equipped;
  }

  static identify(item, batchId = StorageSystem.createBatchId(), index = 0) {
    return StorageSystem.normalizeStoredItem({
      id: StorageSystem.createStoredItemId(item, batchId, index),
      sourceId: item.id,
      identified: true,
      kind: 'equipment',
      quality: item.quality,
      itemLevel: item.itemLevel || 1,
      slot: item.slot,
      baseId: item.baseId || null,
      baseName: item.baseName || null,
      baseTier: item.baseTier || null,
      baseType: item.baseType || null,
      baseStats: StorageSystem.normalizeBaseStats(item.baseStats),
      qualityRank: item.qualityRank || StorageSystem.getQualityRank(item.quality),
      manualDesignRequired: Boolean(item.manualDesignRequired),
      affixes: (item.affixes || []).map((affix) => StorageSystem.normalizeAffix(affix)),
      locked: false
    });
  }

  static createBatchId() {
    StorageSystem.batchCounter += 1;
    return `${Date.now().toString(36)}_${StorageSystem.batchCounter.toString(36)}`;
  }

  static createStoredItemId(item, batchId, index) {
    const sourceId = item && item.id ? item.id : 'item';
    return `identified_${batchId}_${index}_${sourceId}`;
  }

  static normalizeStoredItem(item = {}) {
    return {
      ...item,
      identified: true,
      kind: 'equipment',
      quality: item.quality || 'normal',
      itemLevel: item.itemLevel || 1,
      slot: item.slot,
      baseId: item.baseId || null,
      baseName: item.baseName || null,
      baseTier: item.baseTier || null,
      baseType: item.baseType || null,
      baseStats: StorageSystem.normalizeBaseStats(item.baseStats),
      qualityRank: item.qualityRank || StorageSystem.getQualityRank(item.quality),
      manualDesignRequired: Boolean(item.manualDesignRequired),
      affixes: (item.affixes || []).map((affix) => StorageSystem.normalizeAffix(affix))
    };
  }

  static normalizeAffix(affix = {}) {
    const id = affix.id || affix.type;
    const definition = StorageSystem.getAffixDefinition(id);
    const tier = Math.max(1, Math.min(7, affix.tier || 1));
    return {
      ...affix,
      id,
      type: affix.type || id,
      name: (definition && definition.name) || affix.name || id,
      group: affix.group || (definition && definition.group) || null,
      stat: (definition && definition.stat) || affix.stat || null,
      tier,
      value: Number.isFinite(Number(affix.value))
        ? Number(affix.value)
        : StorageSystem.getAffixValue(definition, tier),
      valueType: (definition && definition.valueType) || affix.valueType || 'flat',
      epicPromoted: Boolean(affix.epicPromoted)
    };
  }

  static normalizeBaseStats(baseStats = {}) {
    return Object.entries(baseStats || {}).reduce((stats, [key, value]) => {
      const numberValue = Number(value);
      if (Number.isFinite(numberValue)) {
        stats[key] = numberValue;
      }
      return stats;
    }, {});
  }

  static isCurrentRuleItem(item) {
    if (!item || (item.kind && item.kind !== 'equipment')) {
      return false;
    }
    if (!StorageSystem.isValidSlot(item.slot)) {
      return false;
    }
    if (!Object.prototype.hasOwnProperty.call(StorageSystem.getQualityRanks(), item.quality)) {
      return false;
    }
    if (!StorageSystem.isCurrentRuleBase(item)) {
      return false;
    }
    return (item.affixes || []).every((affix) => StorageSystem.isCurrentRuleAffix(affix, item.slot));
  }

  static isCurrentRuleBase(item = {}) {
    if (!item.baseId || !item.baseName || !item.baseTier || !item.baseStats) {
      return false;
    }
    const library = globalThis.EquipmentBaseData;
    const bases = library && library.slots ? library.slots[item.slot] || [] : [];
    return bases.some((base) => base.id === item.baseId && base.tier === item.baseTier);
  }

  static isCurrentRuleAffix(affix = {}, slot = null) {
    const id = affix.id || affix.type;
    const definition = StorageSystem.getAffixDefinition(id);
    if (!id || !definition) {
      return false;
    }
    if (slot && !StorageSystem.isAffixAllowedOnSlot(definition, slot)) {
      return false;
    }
    const tier = Number(affix.tier || 0);
    return Number.isInteger(tier) && tier >= 1 && tier <= 7;
  }

  static isAffixAllowedOnSlot(definition, slot) {
    const slotConfig = StorageSystem.getSlotDefinition(slot);
    return Boolean(
      slotConfig &&
      Array.isArray(slotConfig.affixGroups) &&
      slotConfig.affixGroups.includes(definition.group)
    );
  }

  static isValidSlot(slot) {
    return Boolean(StorageSystem.getSlotDefinition(slot));
  }

  static getSlotDefinition(slot) {
    return Boolean(
      globalThis.EquipmentData &&
      Array.isArray(EquipmentData.slots) &&
      EquipmentData.slots.some((entry) => entry.id === slot)
    )
      ? EquipmentData.slots.find((entry) => entry.id === slot)
      : null;
  }

  static getAffixDefinition(id) {
    if (!globalThis.EquipmentData || !Array.isArray(EquipmentData.affixes)) {
      return null;
    }
    return EquipmentData.affixes.find((affix) => affix.id === id) || null;
  }

  static getAffixValue(definition, tier) {
    if (!definition || !Array.isArray(definition.values) || definition.values.length === 0) {
      return 0;
    }
    if (tier <= definition.values.length) {
      return definition.values[tier - 1];
    }

    const values = definition.values;
    const lastValue = values[values.length - 1] || 0;
    const previousValue = values[values.length - 2] || lastValue;
    const step = lastValue - previousValue;
    return Number((lastValue + step * (tier - values.length)).toFixed(4));
  }

  static getQualityRank(quality) {
    return StorageSystem.getQualityRanks()[quality] || 0;
  }

  static getQualityRanks() {
    return {
      normal: 1,
      magic: 2,
      rare: 3,
      epic: 4,
      legendary: 5
    };
  }
}

StorageSystem.storageKey = 'hellSurvival.storage';
StorageSystem.equippedKey = 'hellSurvival.equipped';
StorageSystem.buildKey = 'hellSurvival.build';
StorageSystem.equipmentPurgeKey = 'hellSurvival.equipmentPurgeVersion';
StorageSystem.batchCounter = 0;

globalThis.StorageSystem = StorageSystem;
