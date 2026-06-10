const MonsterVisualData = {
  baselineOffsetY: 59,
  types: {
    boss_floor1: {
      textureKey: 'boss_floor1_sprite',
      displayHeight: 220
    },
    contact_a: {
      textureKey: 'contact_a_sprite',
      displayHeight: 57,
      preserveInnerWhite: true
    },
    contact_b: {
      textureKey: 'contact_b_sprite',
      displayHeight: 84,
      preserveInnerWhite: true
    },
    melee_a: {
      textureKey: 'melee_a_sprite',
      displayHeight: 96
    },
    melee_b: {
      textureKey: 'melee_b_sprite',
      displayHeight: 118,
      preserveInnerWhite: true
    },
    ranged_a: {
      textureKey: 'ranged_a_sprite',
      displayHeight: 92
    },
    ranged_b: {
      textureKey: 'ranged_b_sprite',
      displayHeight: 104
    }
  }
};

globalThis.MonsterVisualData = MonsterVisualData;
