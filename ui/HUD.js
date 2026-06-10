class HUD {
  constructor(scene) {
    this.scene = scene;
    this.logLines = [];
    this.create();
  }

  create() {
    this.statusText = this.scene.add.text(48, 32, '自动探索中。按 L 可打印当前战斗日志。', {
      fontSize: '16px',
      color: '#f2eee2'
    });

    this.scene.add.text(48, 510, 'ESC 菜单 / 1-3 倍速 / N 下一房 / B Boss / P 二阶段 / I 无敌 / L 日志', {
      fontSize: '14px',
      color: '#8f887b'
    });

    this.hpBarBg = this.scene.add.rectangle(48, 68, 180, 12, 0x322d2d).setOrigin(0, 0.5);
    this.hpBar = this.scene.add.rectangle(48, 68, 180, 12, 0xb84f4f).setOrigin(0, 0.5);
    this.hpText = this.scene.add.text(238, 60, '', {
      fontSize: '13px',
      color: '#d8d0c0'
    });

    this.mpBarBg = this.scene.add.rectangle(48, 86, 180, 8, 0x202832).setOrigin(0, 0.5);
    this.mpBar = this.scene.add.rectangle(48, 86, 180, 8, 0x69a7ff).setOrigin(0, 0.5);
    this.mpText = this.scene.add.text(238, 78, '', {
      fontSize: '13px',
      color: '#b6dfff'
    });

    this.goldText = this.scene.add.text(48, 102, '', {
      fontSize: '13px',
      color: '#ffd98a'
    });
    this.bagText = this.scene.add.text(48, 120, '', {
      fontSize: '13px',
      color: '#c9c1b1'
    });
    this.skillText = this.scene.add.text(48, 138, '', {
      fontSize: '13px',
      color: '#ffcf8a'
    });
    this.supportSkillText = this.scene.add.text(48, 156, '', {
      fontSize: '13px',
      color: '#c9c1b1'
    });
    this.equipmentText = this.scene.add.text(48, 174, '', {
      fontSize: '13px',
      color: '#c9c1b1'
    });

    this.invincibleButton = this.scene.add.text(360, 60, '', {
      fontSize: '13px',
      color: '#8f887b',
      backgroundColor: '#1c1a22',
      padding: {
        x: 8,
        y: 4
      }
    });
    this.invincibleButton.setInteractive({ useHandCursor: true });
    this.invincibleButton.on('pointerdown', () => {
      this.scene.toggleInvincible();
    });

    this.speedButton = this.scene.add.text(450, 60, '', {
      fontSize: '13px',
      color: '#ffd98a',
      backgroundColor: '#1c1a22',
      padding: {
        x: 8,
        y: 4
      }
    });
    this.speedButton.setInteractive({ useHandCursor: true });
    this.speedButton.on('pointerdown', () => {
      this.scene.cycleRunSpeedMultiplier();
    });

    this.logText = this.scene.add.text(700, 32, '', {
      fontSize: '14px',
      color: '#d8d0c0',
      lineSpacing: 5
    });
    this.scene.add.rectangle(808, 118, 270, 170, 0x111116, 0.82).setStrokeStyle(1, 0x4c493f);
    this.logText.setDepth(2);
  }

  showStatus(message) {
    return this.measure('HUD.showStatus', () => {
      this.statusText.setText(message);
    });
  }

  addLog(message) {
    return this.measure('HUD.addLog', () => {
      this.logLines.push(message);
      if (this.logLines.length > 8) {
        this.logLines.shift();
      }
      this.logText.setText(this.logLines.join('\n'));
    });
  }

  update(player, bag) {
    return this.measure('HUD.update', () => {
    const hpRatio = Phaser.Math.Clamp(player.hp / player.maxHp, 0, 1);
    const mpRatio = player.maxMp > 0 ? Phaser.Math.Clamp(player.mp / player.maxMp, 0, 1) : 0;

    this.hpBar.width = 180 * hpRatio;
    this.mpBar.width = 180 * mpRatio;
    this.hpText.setText(`HP ${Math.ceil(player.hp)}/${player.maxHp}`);
    this.mpText.setText(`MP ${Math.ceil(player.mp)}/${player.maxMp}`);
    this.invincibleButton.setText(`无敌：${player.isInvincible ? '开' : '关'}`);
    this.invincibleButton.setColor(player.isInvincible ? '#99ffd8' : '#8f887b');
    this.speedButton.setText(`速度：${this.scene.runSpeedMultiplier || 1}x`);
    this.goldText.setText(`纸钱 ${player.gold}`);
    this.bagText.setText(`背包 ${bag.used}/${bag.slots}`);
    this.skillText.setText(this.getSkillLine(player));
    this.supportSkillText.setText(this.getSupportSkillLine(player));
    this.equipmentText.setText('装备需返回鉴定后才可穿戴');
    });
  }

  measure(label, callback) {
    const monitor = globalThis.PerformanceMonitor;
    if (!monitor) {
      return callback();
    }
    return monitor.measure(label, {
      roomId: this.scene.currentRoomId,
      floor: this.scene.currentFloor
    }, callback);
  }

  getSkillLine(player) {
    const skill = window.SkillsData && SkillsData.skills
      ? SkillsData.skills[player.activeSkillId]
      : null;
    if (!skill) {
      return '主动技能：未配置';
    }

    const readyAt = player.skillCooldowns ? player.skillCooldowns[skill.id] || -Infinity : -Infinity;
    const remainingMs = Math.max(0, Math.ceil(readyAt - this.scene.time.now));
    const state = remainingMs > 0 ? `${(remainingMs / 1000).toFixed(1)}s` : '可用';
    return `主动技能：${skill.name} / ${state}`;
  }

  getSupportSkillLine(player) {
    const names = (player.supportSkillIds || []).map((skillId) => {
      const skill = window.SkillsData && SkillsData.supportSkills ? SkillsData.supportSkills[skillId] : null;
      return skill ? skill.name : skillId;
    });
    return `辅助技能：${names.length > 0 ? names.join('、') : '未配置'}`;
  }
}

globalThis.HUD = HUD;
