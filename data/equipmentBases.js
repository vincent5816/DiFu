const EquipmentBaseData = (() => {
  const pct = (value) => Number((value / 100).toFixed(4));
  const clampTier = (tier) => Math.max(1, Math.min(18, Math.round(Number(tier) || 1)));
  const scale = (tier, values) => values[clampTier(tier) - 1];
  const hp = [15, 25, 35, 45, 55, 70, 85, 100, 115, 130, 145, 155, 160, 170, 180, 190, 195, 200];
  const mp = [10, 18, 26, 34, 42, 52, 62, 72, 82, 92, 102, 112, 120, 130, 140, 150, 160, 170];
  const armor = [5, 8, 11, 15, 19, 23, 27, 31, 35, 39, 43, 48, 53, 55, 57, 59, 62, 65];
  const bootsArmor = [4, 6, 8, 11, 14, 17, 20, 23, 26, 29, 31, 33, 35, 38, 41, 44, 47, 50];
  const move = [5, 7, 9, 11, 13, 14, 15, 16, 17, 18, 18, 19, 19, 19, 19, 19, 19, 20].map(pct);
  const attackSpeedBonus = [5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 29, 29, 29, 29, 30].map(pct);
  const critChance = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 13, 14, 15, 16, 17, 18].map(pct);
  const critDamage = [10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 50, 55, 60, 65, 70, 75, 80, 85].map(pct);
  const resistance = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(pct);
  const damageReduction = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 13, 14, 15, 16, 17, 18].map(pct);
  const skillCooldown = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(pct);

  const weaponDamage = [
    ['朽木令牌', 8, 12],
    ['残破符纸', 12, 18],
    ['陶土法印', 16, 24],
    ['兽骨法杖', 20, 30],
    ['竹节令旗', 24, 36],
    ['铜铸法器', 28, 42],
    ['青铜神杖', 32, 48],
    ['玄铁法器', 36, 54],
    ['精铁令牌', 40, 60],
    ['寒钢法印', 44, 66],
    ['灵钢神符', 48, 72],
    ['幽冥法器', 52, 78]
  ];
  const weaponSpeed = [
    ['迟钝符纸', 1],
    ['粗制令旗', 1.06],
    ['轻巧竹杖', 1.12],
    ['轻铜法器', 1.18],
    ['疾铜令牌', 1.24],
    ['灵动符印', 1.3],
    ['轻铁神杖', 1.36],
    ['疾铁法器', 1.42],
    ['灵铁令牌', 1.48],
    ['疾钢法印', 1.54],
    ['灵钢令旗', 1.6],
    ['幽冥疾符', 1.66]
  ];
  const weaponMulti = [
    ['阴司令牌', 56, 84, 1.72],
    ['冥火法器', 60, 90, 1.78],
    ['幽魂神杖', 64, 96, 1.84],
    ['阴司主宰符', 68, 102, 1.9],
    ['冥判神器', 72, 108, 1.96],
    ['地府至尊器', 80, 120, 2]
  ];

  const makeEntry = (slot, id, name, tier, stats, type = 'single') => ({
    id: `${slot}_${id}_${tier}`,
    slot,
    name,
    tier,
    type,
    stats
  });

  const tiered = (slot, id, names, statFactory, type = 'single', start = 1, end = 18) => {
    const entries = [];
    for (let tier = start; tier <= end; tier += 1) {
      const name = names[tier - start] || names[names.length - 1];
      entries.push(makeEntry(slot, id, name, tier, statFactory(tier), type));
    }
    return entries;
  };

  const fixedName = (name) => Array.from({ length: 18 }, () => name);
  const entries = {
    weapon: [
      ...weaponDamage.map(([name, min, max], index) => makeEntry('weapon', 'damage', name, index + 1, {
        attackDamageMin: min,
        attackDamageMax: max
      })),
      ...weaponSpeed.map(([name, speed], index) => makeEntry('weapon', 'speed', name, index + 1, {
        attackSpeed: speed
      })),
      ...weaponMulti.map(([name, min, max, speed], index) => makeEntry('weapon', 'multi', name, index + 13, {
        attackDamageMin: min,
        attackDamageMax: max,
        attackSpeed: speed
      }, 'multi'))
    ],
    helmet: [
      ...tiered('helmet', 'armor', fixedName('铁面盔'), (tier) => ({ armor: scale(tier, armor) }), 'single', 1, 12),
      ...tiered('helmet', 'hp', fixedName('护命盔'), (tier) => ({ maxHpFlat: scale(tier, hp) }), 'single', 1, 12),
      ...tiered('helmet', 'multi', ['幽冥重盔', '阴将神盔', '冥府战盔', '地府铁面盔', '阴司主将盔', '冥王战盔'], (tier) => ({
        armor: scale(tier, armor),
        maxHpFlat: scale(tier, hp)
      }), 'multi', 13, 18)
    ],
    armor: [
      ...tiered('armor', 'armor', fixedName('护身甲'), (tier) => ({ armor: scale(tier, armor) }), 'single', 1, 12),
      ...tiered('armor', 'hp', fixedName('厚生命甲'), (tier) => ({ maxHpFlat: scale(tier, hp) }), 'single', 1, 12),
      ...tiered('armor', 'multi', ['幽冥重甲', '阴将神甲', '冥府战甲', '地府铁甲', '阴司主将甲', '冥土重铠'], (tier) => ({
        armor: scale(tier, armor),
        maxHpFlat: scale(tier, hp)
      }), 'multi', 13, 18)
    ],
    gloves: [
      ...tiered('gloves', 'speed', fixedName('疾行手套'), (tier) => ({ attackSpeedPercent: scale(tier, attackSpeedBonus) }), 'single', 1, 12),
      ...tiered('gloves', 'crit', fixedName('锐击手套'), (tier) => ({ critChancePercent: scale(tier, critChance) }), 'single', 1, 12),
      ...tiered('gloves', 'multi', ['幽冥重拳', '阴将神拳', '冥府战拳', '地府铁拳', '阴司主将拳', '阴司铁拳·极'], (tier) => ({
        attackSpeedPercent: scale(tier, attackSpeedBonus),
        critChancePercent: scale(tier, critChance)
      }), 'multi', 13, 18)
    ],
    boots: [
      ...tiered('boots', 'move', fixedName('疾行靴'), (tier) => ({ moveSpeedPercent: scale(tier, move) }), 'single', 1, 12),
      ...tiered('boots', 'armor', fixedName('铁履'), (tier) => ({ armor: scale(tier, bootsArmor) }), 'single', 1, 12),
      ...tiered('boots', 'multi', ['幽冥重靴', '阴将神靴', '冥府战靴', '地府铁靴', '阴司主将靴', '疾风踏云靴'], (tier) => ({
        moveSpeedPercent: scale(tier, move),
        armor: scale(tier, bootsArmor)
      }), 'multi', 13, 18)
    ],
    amulet: [],
    ring_left: [],
    ring_right: [],
    belt: []
  };

  entries.amulet = [
    ...tiered('amulet', 'hp', fixedName('粗绳项链'), (tier) => ({ maxHpFlat: scale(tier, hp) })),
    ...tiered('amulet', 'mp', fixedName('灵玉吊坠'), (tier) => ({ maxMpFlat: scale(tier, mp) })),
    ...tiered('amulet', 'resist', fixedName('五行护符'), (tier) => ({ resistancePercent: scale(tier, resistance) })),
    ...tiered('amulet', 'crit_damage', fixedName('暴烈骨链'), (tier) => ({ critDamagePercent: scale(tier, critDamage) })),
    ...tiered('amulet', 'skill_cooldown', fixedName('阴阳太极环'), (tier) => ({ skillCooldownReductionPercent: scale(tier, skillCooldown) })),
    ...tiered('amulet', 'multi_hp_mp', fixedName('幽冥双生链'), (tier) => ({ maxHpFlat: scale(tier, hp), maxMpFlat: scale(tier, mp) }), 'multi', 13, 18),
    ...tiered('amulet', 'multi_resist_hp', fixedName('冥府令牌链'), (tier) => ({ resistancePercent: scale(tier, resistance), maxHpFlat: scale(tier, hp) }), 'multi', 13, 18),
    ...tiered('amulet', 'multi_crit_cooldown', fixedName('阴司主宰符'), (tier) => ({ critDamagePercent: scale(tier, critDamage), skillCooldownReductionPercent: scale(tier, skillCooldown) }), 'multi', 13, 18)
  ];

  const ringEntries = [
    ...tiered('ring', 'hp', fixedName('铁戒'), (tier) => ({ maxHpFlat: scale(tier, hp) })),
    ...tiered('ring', 'mp', fixedName('灵石戒'), (tier) => ({ maxMpFlat: scale(tier, mp) })),
    ...tiered('ring', 'resist', fixedName('五行晶戒'), (tier) => ({ resistancePercent: scale(tier, resistance) })),
    ...tiered('ring', 'crit', fixedName('暴击宝戒'), (tier) => ({ critChancePercent: scale(tier, critChance) })),
    ...tiered('ring', 'speed', fixedName('速攻宝戒'), (tier) => ({ attackSpeedPercent: scale(tier, attackSpeedBonus) })),
    ...tiered('ring', 'multi_resist', fixedName('阴阳双鱼戒'), (tier) => ({ resistancePercent: scale(tier, resistance) * 2 }), 'multi', 13, 18),
    ...tiered('ring', 'multi_resist_hp', fixedName('五行聚灵戒'), (tier) => ({ resistancePercent: scale(tier, resistance), maxHpFlat: scale(tier, hp) }), 'multi', 13, 18),
    ...tiered('ring', 'multi_crit', fixedName('冥判戒'), (tier) => ({ critChancePercent: scale(tier, critChance), critDamagePercent: scale(tier, critDamage) }), 'multi', 13, 18)
  ];
  entries.ring_left = ringEntries.map((entry) => ({ ...entry, id: entry.id.replace('ring_', 'ring_left_'), slot: 'ring_left' }));
  entries.ring_right = ringEntries.map((entry) => ({ ...entry, id: entry.id.replace('ring_', 'ring_right_'), slot: 'ring_right' }));

  entries.belt = [
    ...tiered('belt', 'hp', fixedName('麻绳腰带'), (tier) => ({ maxHpFlat: scale(tier, hp) })),
    ...tiered('belt', 'mp', fixedName('灵力腰封'), (tier) => ({ maxMpFlat: scale(tier, mp) })),
    ...tiered('belt', 'reduction', fixedName('铁甲腰围'), (tier) => ({ damageReductionPercent: scale(tier, damageReduction) })),
    ...tiered('belt', 'speed', fixedName('疾行腰带'), (tier) => ({ attackSpeedPercent: scale(tier, attackSpeedBonus) })),
    ...tiered('belt', 'multi_hp_reduction', fixedName('冥将重甲带'), (tier) => ({ maxHpFlat: scale(tier, hp), damageReductionPercent: scale(tier, damageReduction) }), 'multi', 13, 18),
    ...tiered('belt', 'multi_mp_cooldown', fixedName('阴司法相带'), (tier) => ({ maxMpFlat: scale(tier, mp), skillCooldownReductionPercent: scale(tier, skillCooldown) }), 'multi', 13, 18)
  ];

  return {
    maxTier: 18,
    multiMinTier: 13,
    slots: entries,
    clampTier
  };
})();

globalThis.EquipmentBaseData = EquipmentBaseData;
