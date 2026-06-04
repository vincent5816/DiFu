window.DiFuAgent = {
  name: 'boss-test-agent',

  onEvent(snapshot) {
    if (snapshot.event.type !== 'STATE_COMBAT_THREAT') {
      return this.handleCommonEvent(snapshot);
    }

    const details = snapshot.event.details || {};
    if (details.sourceType !== 'boss_floor1') {
      return { action: 'WAIT' };
    }

    const sourceId = snapshot.event.entityId;
    switch (details.threatType) {
      case 'BOSS_CHARGE_WINDUP':
        return { action: 'JUMP' };

      case 'BOSS_STUNNED_A':
      case 'BOSS_STUNNED_B':
        return {
          actions: [
            { delayMs: 0, action: 'DASH', direction: details.direction || 'right' },
            { delayMs: 220, action: 'ATTACK', targetId: sourceId, method: 'normal' }
          ]
        };

      case 'BOSS_NORMAL_WINDUP':
        return { action: 'DEFEND' };

      case 'BOSS_NORMAL_COOLDOWN':
        return { action: 'ATTACK', targetId: sourceId, method: 'normal' };

      case 'BOSS_TRIPLE_HIT':
        if (snapshot.player.canDoubleJump) {
          return { action: 'DOUBLE_JUMP' };
        }
        if (snapshot.player.dashCooldownRemainingMs <= 0) {
          return { action: 'DASH', direction: 'left' };
        }
        return { action: 'DEFEND' };

      default:
        return { action: 'WAIT' };
    }
  },

  handleCommonEvent(snapshot) {
    switch (snapshot.event.type) {
      case 'STATE_NEW_ROOM':
        return { action: 'MOVE', direction: 'right' };
      case 'ENCOUNTER_ENEMY':
        return { action: 'ATTACK', targetId: snapshot.event.entityId, method: 'normal' };
      case 'ENCOUNTER_CHEST':
        return { action: 'OPEN', targetId: snapshot.event.entityId };
      case 'ENCOUNTER_LOOT':
        return { action: 'PICKUP', targetId: snapshot.event.entityId };
      case 'ENCOUNTER_RETURN_POINT':
        return { action: 'RETREAT' };
      case 'STATE_BAG_FULL': {
        const firstItem = snapshot.player.bag.items[0];
        return firstItem ? { action: 'DISCARD', itemId: firstItem.id } : { action: 'WAIT' };
      }
      default:
        return { action: 'WAIT' };
    }
  }
};
