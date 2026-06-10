const EquipmentData = {
  slots: [
    { id: 'weapon', name: 'Weapon', affixGroups: ['attack'] },
    { id: 'helmet', name: 'Helmet', affixGroups: ['defense', 'survival', 'mobility'] },
    { id: 'armor', name: 'Armor', affixGroups: ['defense', 'survival'] },
    { id: 'gloves', name: 'Gloves', affixGroups: ['attack', 'survival_leech'] },
    { id: 'boots', name: 'Boots', affixGroups: ['mobility', 'survival'] },
    { id: 'amulet', name: 'Amulet', affixGroups: ['spirit', 'skill'] },
    { id: 'ring_left', name: 'Ring I', affixGroups: ['attack', 'spirit', 'skill'] },
    { id: 'ring_right', name: 'Ring II', affixGroups: ['attack', 'spirit', 'skill'] },
    { id: 'belt', name: 'Belt', affixGroups: ['survival', 'defense'] }
  ],
  qualities: {
    normal: {
      name: 'Normal',
      color: '#c9c1b1',
      tint: 0xc9c1b1,
      affixCounts: [0],
      weight: 30
    },
    magic: {
      name: 'Magic',
      color: '#69a7ff',
      tint: 0x4f8cff,
      affixCounts: [1, 2],
      weight: 30
    },
    rare: {
      name: 'Rare',
      color: '#ffd166',
      tint: 0xffc857,
      affixCounts: [3, 4, 5, 6],
      weight: 25
    },
    epic: {
      name: 'Epic',
      color: '#c77dff',
      tint: 0x9f7aea,
      affixCounts: [3, 4, 5, 6],
      promotesOneAffix: true,
      weight: 13
    },
    legendary: {
      name: 'Legendary',
      color: '#ff9f43',
      tint: 0xff9f43,
      affixCounts: [0],
      manualDesign: true,
      weight: 2
    }
  },
  tierWeights: [
    {
      minFloor: 1,
      maxFloor: 6,
      weights: [
        { tier: 1, weight: 40 },
        { tier: 2, weight: 35 },
        { tier: 3, weight: 20 },
        { tier: 4, weight: 5 },
        { tier: 5, weight: 0 }
      ]
    },
    {
      minFloor: 7,
      maxFloor: 12,
      weights: [
        { tier: 1, weight: 20 },
        { tier: 2, weight: 30 },
        { tier: 3, weight: 30 },
        { tier: 4, weight: 18 },
        { tier: 5, weight: 2 }
      ]
    },
    {
      minFloor: 13,
      maxFloor: Infinity,
      weights: [
        { tier: 1, weight: 5 },
        { tier: 2, weight: 15 },
        { tier: 3, weight: 30 },
        { tier: 4, weight: 35 },
        { tier: 5, weight: 15 }
      ]
    }
  ],
  affixes: [
    {
      id: 'added_damage',
      name: 'Added Damage',
      group: 'attack',
      stat: 'addedDamage',
      valueType: 'flat',
      values: [2, 4, 6, 9, 12]
    },
    {
      id: 'damage_percent',
      name: 'Damage Percent',
      group: 'attack',
      stat: 'damagePercent',
      valueType: 'percent',
      values: [0.05, 0.1, 0.16, 0.23, 0.3]
    },
    {
      id: 'extra_damage',
      name: 'Extra Damage',
      group: 'attack',
      stat: 'extraDamageMultiplier',
      valueType: 'percent',
      values: [0.03, 0.06, 0.1, 0.15, 0.2]
    },
    {
      id: 'attack_range',
      name: 'Attack Range',
      group: 'attack',
      stat: 'attackRangePercent',
      valueType: 'percent',
      values: [0.05, 0.1, 0.16, 0.24, 0.35]
    },
    {
      id: 'attack_speed',
      name: 'Attack Speed',
      group: 'attack',
      stat: 'attackSpeedPercent',
      valueType: 'percent',
      values: [0.05, 0.1, 0.16, 0.23, 0.3]
    },
    {
      id: 'crit_chance_flat',
      name: 'Critical Chance',
      group: 'attack',
      stat: 'critChanceFlat',
      valueType: 'percent',
      values: [0.02, 0.04, 0.06, 0.09, 0.12]
    },
    {
      id: 'crit_chance_percent',
      name: 'Critical Chance Percent',
      group: 'attack',
      stat: 'critChancePercent',
      valueType: 'percent',
      values: [0.05, 0.1, 0.16, 0.23, 0.3]
    },
    {
      id: 'crit_damage',
      name: 'Critical Damage',
      group: 'attack',
      stat: 'critDamagePercent',
      valueType: 'percent',
      values: [0.1, 0.18, 0.26, 0.33, 0.4]
    },
    {
      id: 'armor',
      name: 'Armor',
      group: 'defense',
      stat: 'armor',
      valueType: 'flat',
      values: [5, 10, 17, 25, 35]
    },
    {
      id: 'damage_reduction',
      name: 'Damage Reduction',
      group: 'defense',
      stat: 'damageReductionPercent',
      valueType: 'percent',
      values: [0.03, 0.06, 0.09, 0.13, 0.18]
    },
    {
      id: 'resistance',
      name: 'Resistance',
      group: 'defense',
      stat: 'resistancePercent',
      valueType: 'percent',
      values: [0.05, 0.1, 0.15, 0.2, 0.25]
    },
    {
      id: 'max_hp_flat',
      name: 'Max HP',
      group: 'survival',
      stat: 'maxHpFlat',
      valueType: 'flat',
      values: [15, 25, 40, 55, 70]
    },
    {
      id: 'max_hp_percent',
      name: 'Max HP Percent',
      group: 'survival',
      stat: 'maxHpPercent',
      valueType: 'percent',
      values: [0.05, 0.1, 0.16, 0.23, 0.3]
    },
    {
      id: 'hp_regen',
      name: 'HP Regen',
      group: 'survival',
      stat: 'hpRegenPerSecond',
      valueType: 'flat',
      values: [0.5, 1, 1.8, 2.5, 3.5]
    },
    {
      id: 'hp_leech',
      name: 'HP Leech',
      group: 'survival_leech',
      stat: 'hpLeechPerHit',
      valueType: 'flat',
      values: [2, 4, 7, 10, 14]
    },
    {
      id: 'move_speed',
      name: 'Move Speed',
      group: 'mobility',
      stat: 'moveSpeedPercent',
      valueType: 'percent',
      values: [0.05, 0.1, 0.16, 0.22, 0.3]
    },
    {
      id: 'vision_radius',
      name: 'Vision Radius',
      group: 'mobility',
      stat: 'visionRadiusPercent',
      valueType: 'percent',
      values: [0.05, 0.1, 0.18, 0.3, 0.5],
      rare: true
    },
    {
      id: 'max_mp_flat',
      name: 'Max Spirit',
      group: 'spirit',
      stat: 'maxMpFlat',
      valueType: 'flat',
      values: [10, 20, 32, 45, 60]
    },
    {
      id: 'max_mp_percent',
      name: 'Max Spirit Percent',
      group: 'spirit',
      stat: 'maxMpPercent',
      valueType: 'percent',
      values: [0.05, 0.1, 0.16, 0.23, 0.3]
    },
    {
      id: 'mp_regen',
      name: 'Spirit Regen',
      group: 'spirit',
      stat: 'mpRegenPerSecond',
      valueType: 'flat',
      values: [0.3, 0.6, 1, 1.5, 2]
    },
    {
      id: 'skill_damage',
      name: 'Skill Damage',
      group: 'skill',
      stat: 'skillDamagePercent',
      valueType: 'percent',
      values: [0.05, 0.1, 0.16, 0.23, 0.3]
    },
    {
      id: 'skill_cooldown',
      name: 'Skill Cooldown',
      group: 'skill',
      stat: 'skillCooldownReductionPercent',
      valueType: 'percent',
      values: [0.05, 0.1, 0.15, 0.2, 0.25]
    },
    {
      id: 'fire_skill_damage',
      name: 'Fire Skill Damage',
      group: 'skill',
      stat: 'fireSkillDamagePercent',
      valueType: 'percent',
      values: [0.05, 0.1, 0.16, 0.23, 0.3]
    },
    {
      id: 'projectile_skill_damage',
      name: 'Projectile Skill Damage',
      group: 'skill',
      stat: 'projectileSkillDamagePercent',
      valueType: 'percent',
      values: [0.05, 0.1, 0.16, 0.23, 0.3]
    },
    {
      id: 'aoe_skill_damage',
      name: 'AOE Skill Damage',
      group: 'skill',
      stat: 'aoeSkillDamagePercent',
      valueType: 'percent',
      values: [0.05, 0.1, 0.16, 0.23, 0.3]
    },
    {
      id: 'dot_skill_damage',
      name: 'DOT Skill Damage',
      group: 'skill',
      stat: 'dotSkillDamagePercent',
      valueType: 'percent',
      values: [0.05, 0.1, 0.16, 0.23, 0.3]
    },
    {
      id: 'protection_skill_duration',
      name: 'Protection Skill Duration',
      group: 'skill',
      stat: 'protectionSkillDurationPercent',
      valueType: 'percent',
      values: [0.05, 0.1, 0.16, 0.23, 0.3]
    }
  ]
};

globalThis.EquipmentData = EquipmentData;
