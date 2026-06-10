const EnemyData = {
  contact_a: {
    kind: 'enemy',
    displayName: '接触怪 A',
    hp: 20,
    maxHp: 20,
    width: 44,
    height: 42,
    fillColor: 0x9f7aea,
    combat: {
      attackType: 'contact',
      behavior: 'patrol',
      contactDamage: 10,
      aoeRadius: 150,
      aoeWindupMs: 720,
      aoeAttackMs: 160,
      aoeCooldownMs: 900,
      moveSpeed: 60,
      patrolRange: 130,
      patrolSpeed: 60,
      knockbackOnHit: true,
      knockbackDistance: 80
    },
    label: {
      text: '接触怪 A',
      color: '#d6bcfa'
    }
  },
  contact_b: {
    kind: 'enemy',
    displayName: '接触怪 B',
    hp: 30,
    maxHp: 30,
    width: 50,
    height: 48,
    fillColor: 0x805ad5,
    combat: {
      attackType: 'contact',
      behavior: 'static',
      contactDamage: 12,
      aoeRadius: 154,
      aoeWindupMs: 760,
      aoeAttackMs: 170,
      aoeCooldownMs: 950,
      moveSpeed: 0,
      patrolRange: 0,
      patrolSpeed: 0,
      knockbackOnHit: false
    },
    label: {
      text: '接触怪 B',
      color: '#d6bcfa'
    }
  },
  melee_a: {
    kind: 'enemy',
    displayName: '近战怪 A',
    hp: 90,
    maxHp: 90,
    width: 42,
    height: 54,
    fillColor: 0xd55f5f,
    combat: {
      attackType: 'melee',
      element: 'wood',
      aggroRange: 200,
      attackRange: 60,
      moveSpeed: 80,
      patrolRange: 90,
      patrolSpeed: 28,
      range: 60,
      hitRange: 60,
      idleMs: 500,
      windupMs: 1500,
      attackMs: 200,
      cooldownMs: 2000,
      damage: 12
    },
    label: {
      text: '近战怪 A',
      color: '#ffb1a7'
    }
  },
  melee_b: {
    kind: 'enemy',
    displayName: '近战怪 B',
    hp: 180,
    maxHp: 180,
    width: 44,
    height: 56,
    fillColor: 0xe66a3c,
    combat: {
      attackType: 'melee',
      element: 'fire',
      aggroRange: 200,
      attackRange: 200,
      moveSpeed: 80,
      patrolRange: 90,
      patrolSpeed: 28,
      range: 200,
      hitRange: 200,
      idleMs: 500,
      windupMs: 1000,
      attackMs: 200,
      cooldownMs: 1500,
      damage: 27
    },
    label: {
      text: '近战怪 B',
      color: '#ffb199'
    }
  },
  ranged_a: {
    kind: 'enemy',
    displayName: '远程怪 A',
    hp: 60,
    maxHp: 60,
    width: 42,
    height: 54,
    fillColor: 0xd55f5f,
    combat: {
      attackType: 'ranged',
      element: 'wood',
      range: 300,
      aggroRange: 300,
      attackRange: 300,
      idleMs: 500,
      windupMs: 0,
      attackMs: 200,
      cooldownMs: 1500,
      damage: 5,
      projectileSpeed: 150,
      projectileTtlMs: 2400,
      projectileInterval: 1500,
      panicCooldownOnMelee: 800
    },
    label: {
      text: '远程怪 A',
      color: '#ffb1a7'
    }
  },
  ranged_b: {
    kind: 'enemy',
    displayName: '远程怪 B',
    hp: 75,
    maxHp: 75,
    width: 44,
    height: 54,
    fillColor: 0xe66a3c,
    combat: {
      attackType: 'ranged',
      element: 'fire',
      range: 300,
      aggroRange: 300,
      attackRange: 300,
      idleMs: 500,
      windupMs: 0,
      attackMs: 1520,
      cooldownMs: 1800,
      damage: 3,
      projectileSpeed: 250,
      projectileTtlMs: 1800,
      projectileInterval: 380,
      burstCount: 5,
      burstInterval: 380,
      burstCooldown: 1800,
      panicCooldownOnMelee: 600
    },
    label: {
      text: '远程怪 B',
      color: '#ffb199'
    }
  },
  boss_floor1: {
    kind: 'enemy',
    displayName: '第一层 Boss',
    hp: 300,
    maxHp: 300,
    width: 72,
    height: 90,
    fillColor: 0x9b8c7a,
    combat: {
      attackType: 'boss',
      behavior: 'boss_floor1',
      element: 'metal',
      phase2Threshold: 0.4,
      moveSpeed: 200,
      chargeCooldownMs: 12000,
      chargeWindupMs: 550,
      chargeSpeed: 400,
      chargeDamage: 30,
      stunOnWallMs: 2000,
      normalAttackDamage: 18,
      normalAttackRange: 95,
      normalWindupMs: 1400,
      normalAttackMs: 200,
      normalCooldownMs: 900,
      normalMoveSpeed: 90,
      repositionMs: 800,
      preferredGap: 80,
      phase2TriggerMs: 800,
      tripleHitCooldownMs: 10000,
      tripleHitDamage: 15,
      tripleHitInterval: 400,
      tripleHitAttackMs: 200,
      stunAfterTripleMs: 2000
    },
    label: {
      text: '第一层 Boss',
      color: '#f2eee2'
    }
  }
};

globalThis.EnemyData = EnemyData;
