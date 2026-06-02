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
  attackDamage: 10,
  attackRange: 90,
  attackCooldownMs: 600,
  gold: 120,
  buffs: [
    { type: 'ATK_UP', remainingTime: 30 }
  ],
  bag: {
    slots: 2,
    used: 1,
    items: [
      { id: 'item_001', quality: 'rare' }
    ]
  }
};

globalThis.PlayerData = PlayerData;
