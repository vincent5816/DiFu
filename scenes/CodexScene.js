class CodexScene extends Phaser.Scene {
  constructor() {
    super('CodexScene');
  }

  create() {
    const entries = ProgressSystem.listCodexEntries()
      .sort((a, b) => a.type.localeCompare(b.type));

    this.add.text(48, 42, '图鉴', {
      fontSize: '30px',
      color: '#f2eee2'
    });

    this.add.text(48, 82, '已遭遇的怪物会记录在这里。战斗参数来自当前 EnemyData。', {
      fontSize: '14px',
      color: '#8f887b'
    });

    if (entries.length === 0) {
      this.add.text(48, 128, '尚未解锁任何条目', {
        fontSize: '16px',
        color: '#8f887b'
      });
    } else {
      entries.forEach((entry, index) => {
        this.renderEntry(entry, 48, 128 + index * 128);
      });
    }

    this.add.text(48, 690, '按 ESC 返回策略编辑器', {
      fontSize: '14px',
      color: '#8f887b'
    });

    this.input.keyboard.on('keydown-ESC', () => {
      this.scene.start('MenuScene');
    });
  }

  renderEntry(entry, x, y) {
    const enemy = globalThis.EnemyData && globalThis.EnemyData[entry.type];
    const name = StrategyConfig.getEnemyDisplayName(entry.type);
    const unlockedAt = this.formatDate(entry.unlockedAt);

    this.add.text(x, y, `${name}  (${entry.type})`, {
      fontSize: '18px',
      color: '#f2eee2'
    });
    this.add.text(x, y + 26, `解锁时间：${unlockedAt}`, {
      fontSize: '13px',
      color: '#8f887b'
    });

    if (!enemy || !enemy.combat) {
      this.add.text(x, y + 52, '暂无战斗数据', {
        fontSize: '14px',
        color: '#c9c1b1'
      });
      return;
    }

    const combat = enemy.combat;
    const lines = [
      `生命：${enemy.maxHp || enemy.hp || '-'}    攻击类型：${this.getAttackTypeLabel(combat.attackType)}    伤害：${combat.damage}`,
      `警戒范围：${combat.range}    命中范围：${combat.hitRange || '-'}    投射物速度：${combat.projectileSpeed || '-'}`,
      `时间轴：空闲 ${combat.idleMs}ms / 前摇 ${combat.windupMs}ms / 攻击 ${combat.attackMs}ms / 冷却 ${combat.cooldownMs}ms`,
      `可响应事件：${StrategyConfig.getSupportedEventsForEnemy(entry.type).map((type) => StrategyConfig.getEventDisplayName(type)).join('、')}`
    ];

    this.add.text(x, y + 52, lines.join('\n'), {
      fontSize: '14px',
      lineSpacing: 6,
      color: '#d8d0c0'
    });
  }

  getAttackTypeLabel(type) {
    if (type === 'melee') {
      return '近战';
    }
    if (type === 'ranged') {
      return '远程';
    }
    return type || '-';
  }

  formatDate(value) {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString('zh-CN', {
      hour12: false
    });
  }
}

window.CodexScene = CodexScene;
