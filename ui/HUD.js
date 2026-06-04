class HUD {
  constructor(scene) {
    this.scene = scene;
    this.logLines = [];
    this.create();
  }

  create() {
    this.statusText = this.scene.add.text(48, 32, 'Auto exploring. Open DevTools console for event logs.', {
      fontSize: '16px',
      color: '#f2eee2'
    });

    this.scene.add.text(48, 510, 'ESC Menu / N Next / B Boss / P Phase2 / I Invincible', {
      fontSize: '14px',
      color: '#8f887b'
    });

    this.hpBarBg = this.scene.add.rectangle(48, 68, 180, 12, 0x322d2d).setOrigin(0, 0.5);
    this.hpBar = this.scene.add.rectangle(48, 68, 180, 12, 0xb84f4f).setOrigin(0, 0.5);
    this.hpText = this.scene.add.text(238, 60, '', {
      fontSize: '13px',
      color: '#d8d0c0'
    });
    this.goldText = this.scene.add.text(48, 82, '', {
      fontSize: '13px',
      color: '#ffd98a'
    });
    this.bagText = this.scene.add.text(48, 100, '', {
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

    this.logText = this.scene.add.text(700, 32, '', {
      fontSize: '14px',
      color: '#d8d0c0',
      lineSpacing: 5
    });
    this.scene.add.rectangle(808, 118, 270, 170, 0x111116, 0.82).setStrokeStyle(1, 0x4c493f);
    this.logText.setDepth(2);
  }

  showStatus(message) {
    this.statusText.setText(message);
  }

  addLog(message) {
    this.logLines.push(message);
    if (this.logLines.length > 8) {
      this.logLines.shift();
    }
    this.logText.setText(this.logLines.join('\n'));
  }

  update(player, bag) {
    const ratio = Phaser.Math.Clamp(player.hp / player.maxHp, 0, 1);
    this.hpBar.width = 180 * ratio;
    this.hpText.setText(`HP ${Math.ceil(player.hp)}/${player.maxHp}`);
    this.invincibleButton.setText(`INVINCIBLE: ${player.isInvincible ? 'ON' : 'OFF'}`);
    this.invincibleButton.setColor(player.isInvincible ? '#99ffd8' : '#8f887b');
    this.goldText.setText(`纸钱 ${player.gold}`);
    this.bagText.setText(`背包 ${bag.used}/${bag.slots}`);
  }
}

globalThis.HUD = HUD;
