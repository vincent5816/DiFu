const SkillsData = {
  activeSkillIds: ['piercing_flame', 'burning_aura', 'reflect_guard'],
  supportSkillIds: [
    'spirit_siphon',
    'emergency_shield',
    'sprint',
    'charge_mark',
    'burning_resonance',
    'flesh_siphon',
    'resilience',
    'aftershock'
  ],
  defaultActiveSkillId: 'piercing_flame',
  defaultSupportSkillIds: ['spirit_siphon', 'emergency_shield'],
  skillCooldownFloorMs: 250,
  critMultiplier: 1.5,
  skills: {
    piercing_flame: {
      id: 'piercing_flame',
      name: '直线穿透',
      description: '向当前目标释放直线投射技能，造成火焰投射物伤害。',
      slotType: 'active',
      element: 'fire',
      tags: ['fire', 'projectile', 'skill'],
      damageMultiplier: 1.5,
      range: 640,
      mpCost: 50,
      cooldownMs: 8000
    },
    burning_aura: {
      id: 'burning_aura',
      name: '近身灼烧',
      description: '在角色周围形成持续灼烧区域，对范围内敌人造成周期伤害。',
      slotType: 'active',
      element: 'fire',
      tags: ['fire', 'aoe', 'dot', 'curse', 'skill'],
      damagePerTick: 5,
      tickMs: 1000,
      radius: 120,
      durationMs: 15000,
      mpCost: 50,
      cooldownMs: 20000
    },
    reflect_guard: {
      id: 'reflect_guard',
      name: '无界反伤',
      description: '短时间进入防护状态，受到攻击时对攻击者造成反伤。',
      slotType: 'active',
      element: 'yin_yang',
      tags: ['yin_yang', 'protection', 'skill'],
      reflectPercent: 1,
      durationMs: 3000,
      mpCost: 50,
      cooldownMs: 15000
    }
  },
  supportSkills: {
    spirit_siphon: {
      id: 'spirit_siphon',
      name: '灵力汲取',
      description: '击败敌人时回复灵力。',
      slotType: 'support',
      element: 'wood',
      tags: ['wood', 'continuous', 'support'],
      mpOnKill: 15
    },
    emergency_shield: {
      id: 'emergency_shield',
      name: '应急护盾',
      description: '间隔触发的保命护盾，吸收一部分即将受到的伤害。',
      slotType: 'support',
      element: 'earth',
      tags: ['earth', 'protection', 'support'],
      intervalMs: 60000,
      absorbMaxHpRatio: 0.2
    },
    sprint: {
      id: 'sprint',
      name: '疾步',
      description: '提高角色移动速度。',
      slotType: 'support',
      element: 'metal',
      tags: ['metal', 'movement', 'support'],
      moveSpeedPercent: 0.15
    },
    charge_mark: {
      id: 'charge_mark',
      name: '蓄力印记',
      description: '连续命中同一目标后，为下一次命中提供额外暴击机会。',
      slotType: 'support',
      element: 'wood',
      tags: ['wood', 'curse', 'support'],
      requiredHits: 3,
      nextHitCritChanceBonus: 0.4
    },
    burning_resonance: {
      id: 'burning_resonance',
      name: '燃烧共鸣',
      description: '角色受到持续伤害影响时，普通攻击伤害提高。',
      slotType: 'support',
      element: 'fire',
      tags: ['fire', 'continuous', 'support'],
      normalAttackDamagePercentWhileTakingDot: 0.3
    },
    flesh_siphon: {
      id: 'flesh_siphon',
      name: '血肉汲取',
      description: '普通攻击命中后按造成的伤害回复生命。',
      slotType: 'support',
      element: 'water',
      tags: ['water', 'continuous', 'support'],
      normalAttackLeechPercent: 0.3
    },
    resilience: {
      id: 'resilience',
      name: '韧性',
      description: '降低角色受到的伤害。',
      slotType: 'support',
      element: 'earth',
      tags: ['earth', 'protection', 'support'],
      damageReductionPercent: 0.1
    },
    aftershock: {
      id: 'aftershock',
      name: '余震',
      description: '触发后强化下一次普通攻击的伤害。',
      slotType: 'support',
      element: 'metal',
      tags: ['metal', 'melee', 'support'],
      nextAttackDamagePercent: 0.5
    }
  }
};

globalThis.SkillsData = SkillsData;
