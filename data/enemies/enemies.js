const EnemyData = {
  skeleton_archer: {
    kind: 'enemy',
    displayName: '远程怪',
    hp: 20,
    maxHp: 20,
    width: 42,
    height: 54,
    fillColor: 0xd55f5f,
    combat: {
      attackType: 'ranged',
      range: 260,
      idleMs: 500,
      windupMs: 1000,
      attackMs: 500,
      cooldownMs: 1000,
      damage: 8,
      projectileSpeed: 260,
      projectileTtlMs: 1800
    },
    label: {
      text: '远程怪',
      color: '#ffb1a7'
    }
  },
  skeleton_guard: {
    kind: 'enemy',
    displayName: '近战怪',
    hp: 30,
    maxHp: 30,
    width: 42,
    height: 54,
    fillColor: 0xd55f5f,
    combat: {
      attackType: 'melee',
      range: 140,
      hitRange: 90,
      idleMs: 500,
      windupMs: 1000,
      attackMs: 500,
      cooldownMs: 1000,
      damage: 12
    },
    label: {
      text: '近战怪',
      color: '#ffb1a7'
    }
  }
};

globalThis.EnemyData = EnemyData;
