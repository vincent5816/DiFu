class EquipmentSystem {
  constructor(scene) {
    this.scene = scene;
  }

  initializePlayer(player) {
    player.baseStats = {
      maxHp: player.maxHp,
      maxMp: player.maxMp,
      mpRegenPerSecond: player.mpRegenPerSecond || 0,
      hpRegenPerSecond: player.hpRegenPerSecond || 0,
      hpLeechPerHit: player.hpLeechPerHit || 0,
      attackDamage: player.attackDamage,
      attackDamageMin: player.attackDamage,
      attackDamageMax: player.attackDamage,
      attackRange: player.attackRange,
      attackCooldownMs: player.attackCooldownMs,
      attackSpeed: 1000 / Math.max(1, player.attackCooldownMs || 600),
      visionRadius: this.scene.visionRadius,
      moveSpeedPercent: player.moveSpeedPercent || 0,
      armor: player.armor || 0,
      damageReductionPercent: player.damageReductionPercent || 0,
      resistancePercent: player.resistancePercent || 0,
      critChancePercent: player.critChancePercent || 0,
      critDamagePercent: player.critDamagePercent || 0
    };
    player.equipment = this.normalizeEquipment(player.equipment);
    player.equipmentQuality = 0;
    player.equipmentStats = this.getEquipmentTotals(player.equipment);
    player.skillStats = this.getSkillStats(player.equipmentStats);
  }

  createEmptyEquipment() {
    return EquipmentData.slots.reduce((equipment, slot) => {
      equipment[slot.id] = null;
      return equipment;
    }, {});
  }

  normalizeEquipment(equipment = {}) {
    return EquipmentData.slots.reduce((normalized, slot) => {
      normalized[slot.id] = equipment[slot.id] || null;
      return normalized;
    }, {});
  }

  createRandomItem(itemId, quality = null) {
    const selectedQuality = quality || this.pickQuality();
    const qualityConfig = EquipmentData.qualities[selectedQuality] || EquipmentData.qualities.magic;
    const itemLevel = Math.max(1, this.scene.currentFloor || 1);
    const slotConfig = Phaser.Utils.Array.GetRandom(EquipmentData.slots);
    const slot = slotConfig.id;
    const base = this.rollBase(slot, itemLevel);
    const affixCount = this.rollAffixCount(qualityConfig);
    const affixes = qualityConfig.manualDesign
      ? []
      : this.rollAffixes(affixCount, qualityConfig, slotConfig, itemLevel);
    const item = {
      id: itemId,
      kind: 'equipment',
      identified: false,
      quality: selectedQuality,
      itemLevel,
      slot,
      baseId: base ? base.id : null,
      baseName: base ? base.name : null,
      baseTier: base ? base.tier : null,
      baseType: base ? base.type : null,
      baseStats: base ? { ...base.stats } : {},
      affixes,
      manualDesignRequired: Boolean(qualityConfig.manualDesign)
    };
    item.qualityRank = this.getQualityRank(item.quality);
    return item;
  }

  rollBase(slot, itemLevel) {
    const library = globalThis.EquipmentBaseData;
    const slotBases = library && library.slots ? library.slots[slot] || [] : [];
    if (slotBases.length === 0) {
      return null;
    }

    const tier = library.clampTier ? library.clampTier(itemLevel) : Math.max(1, Math.min(18, itemLevel || 1));
    const desiredType = tier >= (library.multiMinTier || 13) ? 'multi' : 'single';
    const exact = slotBases.filter((base) => base.tier === tier && base.type === desiredType);
    const sameTier = slotBases.filter((base) => base.tier === tier);
    const candidates = exact.length > 0 ? exact : sameTier.length > 0 ? sameTier : slotBases;
    return Phaser.Utils.Array.GetRandom(candidates);
  }

  pickQuality() {
    const entries = Object.entries(EquipmentData.qualities).filter(([, config]) => config.weight > 0);
    const totalWeight = entries.reduce((sum, [, config]) => sum + config.weight, 0);
    let roll = Phaser.Math.Between(1, totalWeight);
    for (const [quality, config] of entries) {
      roll -= config.weight;
      if (roll <= 0) {
        return quality;
      }
    }
    return 'magic';
  }

  rollAffixCount(qualityConfig) {
    const counts = qualityConfig.affixCounts || [0];
    return Phaser.Utils.Array.GetRandom(counts);
  }

  rollAffixes(count, qualityConfig, slotConfig, itemLevel) {
    if (count <= 0) {
      return [];
    }

    const allowedGroups = slotConfig.affixGroups || [];
    const pool = Phaser.Utils.Array.Shuffle(
      EquipmentData.affixes.filter((affix) => allowedGroups.includes(affix.group))
    );
    const affixes = [];
    const safeCount = Math.min(count, pool.length);

    for (let index = 0; index < safeCount; index += 1) {
      const definition = pool[index];
      const tier = this.rollTier(itemLevel);
      affixes.push({
        id: definition.id,
        name: definition.name,
        group: definition.group,
        stat: definition.stat,
        valueType: definition.valueType || 'flat',
        tier,
        value: this.getAffixValue(definition, tier)
      });
    }

    if (qualityConfig.promotesOneAffix && affixes.length > 0) {
      this.promoteEpicAffix(affixes);
    }

    return affixes;
  }

  rollTier(itemLevel) {
    const range = EquipmentData.tierWeights.find((entry) => {
      return itemLevel >= entry.minFloor && itemLevel <= entry.maxFloor;
    }) || EquipmentData.tierWeights[0];
    const entries = range.weights.filter((entry) => entry.weight > 0);
    const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Phaser.Math.Between(1, totalWeight);

    for (const entry of entries) {
      roll -= entry.weight;
      if (roll <= 0) {
        return entry.tier;
      }
    }

    return 1;
  }

  promoteEpicAffix(affixes) {
    const promotedAffix = Phaser.Utils.Array.GetRandom(affixes);
    const definition = EquipmentData.affixes.find((affix) => affix.id === promotedAffix.id);
    const promotedTier = Phaser.Math.Between(1, 100) <= 90 ? 6 : 7;

    promotedAffix.tier = promotedTier;
    promotedAffix.epicPromoted = true;
    promotedAffix.value = this.getAffixValue(definition, promotedTier);
  }

  getAffixValue(definition, tier) {
    const values = (definition && definition.values) || [0];
    if (tier <= values.length) {
      return values[tier - 1];
    }

    const lastValue = values[values.length - 1] || 0;
    const previousValue = values[values.length - 2] || lastValue;
    const step = lastValue - previousValue;
    return Number((lastValue + step * (tier - values.length)).toFixed(4));
  }

  applyEquipmentStats(player, options = {}) {
    const baseStats = player.baseStats || {
      maxHp: player.maxHp,
      maxMp: player.maxMp,
      mpRegenPerSecond: player.mpRegenPerSecond || 0,
      hpRegenPerSecond: player.hpRegenPerSecond || 0,
      hpLeechPerHit: player.hpLeechPerHit || 0,
      attackDamage: player.attackDamage,
      attackDamageMin: player.attackDamage,
      attackDamageMax: player.attackDamage,
      attackRange: player.attackRange,
      attackCooldownMs: player.attackCooldownMs,
      attackSpeed: 1000 / Math.max(1, player.attackCooldownMs || 600),
      visionRadius: this.scene.visionRadius,
      moveSpeedPercent: player.moveSpeedPercent || 0,
      armor: player.armor || 0,
      damageReductionPercent: player.damageReductionPercent || 0,
      resistancePercent: player.resistancePercent || 0,
      critChancePercent: player.critChancePercent || 0,
      critDamagePercent: player.critDamagePercent || 0
    };
    const hpRatio = player.maxHp > 0 ? player.hp / player.maxHp : 1;
    const mpRatio = player.maxMp > 0 ? player.mp / player.maxMp : 1;
    const totals = this.getEquipmentTotals(player.equipment);
    const previousMaxHp = player.maxHp;

    player.maxHp = Math.max(1, Math.round(baseStats.maxHp * (1 + totals.maxHpPercent) + totals.maxHp));
    player.maxMp = Math.max(0, Math.round(baseStats.maxMp * (1 + totals.maxMpPercent) + totals.maxMp));
    player.mpRegenPerSecond = baseStats.mpRegenPerSecond + totals.mpRegenPerSecond;
    player.hpRegenPerSecond = baseStats.hpRegenPerSecond + totals.hpRegenPerSecond;
    player.hpLeechPerHit = baseStats.hpLeechPerHit + totals.hpLeechPerHit;
    const damageMultiplier = 1 + totals.damagePercent + totals.extraDamageMultiplier;
    const hasWeaponDamageBase = totals.attackDamageMin > 0 || totals.attackDamageMax > 0;
    const baseDamageMin = hasWeaponDamageBase ? totals.attackDamageMin : baseStats.attackDamageMin;
    const baseDamageMax = hasWeaponDamageBase ? totals.attackDamageMax : baseStats.attackDamageMax;
    const minDamage = Math.round((baseDamageMin + totals.attackDamage) * damageMultiplier);
    const maxDamage = Math.round((baseDamageMax + totals.attackDamage) * damageMultiplier);
    player.attackDamageMin = Math.max(1, Math.min(minDamage, maxDamage));
    player.attackDamageMax = Math.max(player.attackDamageMin, Math.max(minDamage, maxDamage));
    player.attackDamage = Math.max(1, Math.round((player.attackDamageMin + player.attackDamageMax) / 2));
    player.attackRange = Math.max(20, Math.round(baseStats.attackRange * (1 + totals.attackRangePercent) + totals.attackRange));
    const attackSpeedBase = totals.attackSpeed > 0 ? totals.attackSpeed : baseStats.attackSpeed;
    player.attackSpeed = Math.max(0.2, attackSpeedBase * (1 + totals.attackSpeedPercent));
    player.attackCooldownMs = Math.max(260, Math.round(1000 / player.attackSpeed));
    player.armor = baseStats.armor + totals.armor;
    player.damageReductionPercent = Math.min(0.8, baseStats.damageReductionPercent + totals.damageReductionPercent + Math.max(0, player.armor) / 100);
    player.resistancePercent = Math.min(0.8, baseStats.resistancePercent + totals.resistancePercent);
    player.critChancePercent = Math.min(1, baseStats.critChancePercent + totals.critChancePercent);
    player.critDamagePercent = baseStats.critDamagePercent + totals.critDamagePercent;
    player.moveSpeedPercent = baseStats.moveSpeedPercent + totals.moveSpeedPercent + this.getSupportMoveSpeedPercent(player);
    this.scene.visionRadius = Math.max(80, Math.round(baseStats.visionRadius * (1 + totals.visionRadiusPercent) + totals.visionRadius));
    const visionCircle = this.scene.visionCircle;
    if (
      visionCircle &&
      visionCircle.active !== false &&
      visionCircle.geom &&
      typeof visionCircle.setRadius === 'function'
    ) {
      visionCircle.setRadius(this.scene.visionRadius);
    }
    player.equipmentQuality = this.getEquipmentQualityTotal(player.equipment);
    player.equipmentStats = totals;
    player.skillStats = this.getSkillStats(totals);

    if (options.preserveHpRatio) {
      player.hp = Phaser.Math.Clamp(Math.round(player.maxHp * hpRatio), 1, player.maxHp);
      player.mp = Phaser.Math.Clamp(Math.round(player.maxMp * mpRatio), 0, player.maxMp);
    } else if (player.maxHp > previousMaxHp) {
      player.hp += player.maxHp - previousMaxHp;
    } else {
      player.hp = Math.min(player.hp, player.maxHp);
    }
    player.mp = Math.min(player.mp, player.maxMp);
  }

  getEquipmentTotals(equipment) {
    const totals = {
      maxHp: 0,
      maxHpPercent: 0,
      maxMp: 0,
      maxMpPercent: 0,
      mpRegenPerSecond: 0,
      hpRegenPerSecond: 0,
      hpLeechPerHit: 0,
      attackDamage: 0,
      attackDamageMin: 0,
      attackDamageMax: 0,
      damagePercent: 0,
      extraDamageMultiplier: 0,
      attackRange: 0,
      attackRangePercent: 0,
      attackSpeed: 0,
      attackSpeedPercent: 0,
      moveSpeedPercent: 0,
      visionRadius: 0,
      visionRadiusPercent: 0,
      armor: 0,
      damageReductionPercent: 0,
      resistancePercent: 0,
      critChanceFlat: 0,
      critChancePercent: 0,
      critDamagePercent: 0,
      skillDamagePercent: 0,
      skillCooldownReductionPercent: 0,
      fireSkillDamagePercent: 0,
      projectileSkillDamagePercent: 0,
      aoeSkillDamagePercent: 0,
      dotSkillDamagePercent: 0,
      protectionSkillDurationPercent: 0
    };

    Object.values(equipment || {}).forEach((item) => {
      if (!item) {
        return;
      }
      this.addStatsToTotals(totals, item.baseStats || {});
      if (!Array.isArray(item.affixes)) {
        return;
      }
      item.affixes.forEach((affix) => {
        this.addStatToTotals(totals, affix.stat, Number(affix.value) || 0);
        if (affix.stat === 'addedDamage') {
          totals.attackDamage += Number(affix.value) || 0;
        }
        if (affix.stat === 'maxHpFlat') {
          totals.maxHp += Number(affix.value) || 0;
        }
        if (affix.stat === 'maxMpFlat') {
          totals.maxMp += Number(affix.value) || 0;
        }
      });
    });

    totals.attackSpeedPercent = Math.min(1.5, totals.attackSpeedPercent);
    totals.critChancePercent += totals.critChanceFlat;
    totals.skillCooldownReductionPercent = Math.min(0.75, totals.skillCooldownReductionPercent);
    totals.damageReductionPercent = Math.min(0.8, totals.damageReductionPercent);
    return totals;
  }

  addStatsToTotals(totals, stats = {}) {
    Object.entries(stats || {}).forEach(([stat, value]) => {
      this.addStatToTotals(totals, stat, Number(value) || 0);
    });
  }

  addStatToTotals(totals, stat, value) {
    if (!stat || !Object.prototype.hasOwnProperty.call(totals, stat)) {
      if (stat === 'attackCooldownPercent') {
        totals.attackSpeedPercent += value;
      }
      return;
    }
    totals[stat] += value;
  }

  getSkillStats(totals) {
    return {
      damagePercent: totals.skillDamagePercent || 0,
      cooldownReductionPercent: totals.skillCooldownReductionPercent || 0,
      tagDamagePercent: {
        fire: totals.fireSkillDamagePercent || 0,
        projectile: totals.projectileSkillDamagePercent || 0,
        aoe: totals.aoeSkillDamagePercent || 0,
        dot: totals.dotSkillDamagePercent || 0
      },
      tagDurationPercent: {
        protection: totals.protectionSkillDurationPercent || 0
      }
    };
  }

  getEquipmentQualityTotal(equipment) {
    return Object.values(equipment || {}).reduce((sum, item) => sum + this.getQualityRank(item && item.quality), 0);
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

  getStatSummary(player) {
    return {
      maxHp: player.maxHp,
      maxMp: player.maxMp,
      mpRegenPerSecond: player.mpRegenPerSecond || 0,
      hpRegenPerSecond: player.hpRegenPerSecond || 0,
      hpLeechPerHit: player.hpLeechPerHit || 0,
      attackDamage: player.attackDamage,
      attackDamageMin: player.attackDamageMin || player.attackDamage,
      attackDamageMax: player.attackDamageMax || player.attackDamage,
      attackRange: player.attackRange,
      attackCooldownMs: player.attackCooldownMs,
      attackSpeed: player.attackSpeed || 0,
      moveSpeedPercent: player.moveSpeedPercent || 0,
      armor: player.armor || 0,
      damageReductionPercent: player.damageReductionPercent || 0,
      resistancePercent: player.resistancePercent || 0,
      critChancePercent: player.critChancePercent || 0,
      critDamagePercent: player.critDamagePercent || 0,
      visionRadius: this.scene.visionRadius,
      equipmentQuality: player.equipmentQuality || 0,
      skillStats: player.skillStats || {}
    };
  }

  getSnapshot() {
    const equipment = this.scene.player.equipment || {};
    return Object.entries(equipment).reduce((snapshot, [slot, item]) => {
      snapshot[slot] = item ? this.createItemSnapshot(item) : null;
      return snapshot;
    }, {});
  }

  createItemSnapshot(item) {
    return {
      id: item.id,
      quality: item.quality,
      itemLevel: item.itemLevel || 1,
      slot: item.slot,
      baseId: item.baseId || null,
      baseName: item.baseName || null,
      baseTier: item.baseTier || null,
      baseType: item.baseType || null,
      baseStats: { ...(item.baseStats || {}) },
      qualityRank: item.qualityRank || this.getQualityRank(item.quality),
      manualDesignRequired: Boolean(item.manualDesignRequired),
      affixes: (item.affixes || []).map((affix) => ({
        id: affix.id,
        stat: affix.stat || null,
        tier: affix.tier,
        value: affix.value,
        valueType: affix.valueType || 'flat',
        epicPromoted: Boolean(affix.epicPromoted)
      }))
    };
  }

  getSupportMoveSpeedPercent(player) {
    if (!(player.supportSkillIds || []).includes('sprint')) {
      return 0;
    }

    const skill = window.SkillsData && SkillsData.supportSkills
      ? SkillsData.supportSkills.sprint
      : null;
    return skill ? skill.moveSpeedPercent || 0 : 0;
  }
}

globalThis.EquipmentSystem = EquipmentSystem;
