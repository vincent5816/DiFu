const PlayerData = {
  id: 'player_001',
  width: 42,
  height: 60,
  fillColor: 0x78c2ff,
  label: {
    text: '驱魔人',
    color: '#b6dfff'
  },
  hp: 100,
  maxHp: 100,
  mp: 50,
  maxMp: 100,
  mpRegenPerSecond: 2,
  hpRegenPerSecond: 0,
  hpLeechPerHit: 0,
  skills: ['piercing_flame'],
  activeSkillId: 'piercing_flame',
  unlockedActiveSkillIds: ['piercing_flame', 'burning_aura', 'reflect_guard'],
  supportSkillIds: ['spirit_siphon', 'emergency_shield'],
  unlockedSupportSkillIds: [
    'spirit_siphon',
    'emergency_shield',
    'sprint',
    'charge_mark',
    'burning_resonance',
    'flesh_siphon',
    'resilience',
    'aftershock'
  ],
  skillCooldowns: {},
  attackDamage: 10,
  attackRange: 90,
  attackCooldownMs: 600,
  gold: 0,
  buffs: [
    { type: 'ATK_UP', remainingTime: 30 }
  ],
  bag: {
    slots: 30,
    used: 0,
    items: []
  }
};

globalThis.PlayerData = PlayerData;
