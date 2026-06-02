class ReturnScene extends Phaser.Scene {
  constructor() {
    super('ReturnScene');
    this.summary = null;
    this.identifiedItems = [];
    this.hasIdentified = false;
  }

  init(data) {
    this.summary = data || null;
  }

  create() {
    const summary = this.summary || {
      result: 'unknown',
      floor: 1,
      roomId: 'unknown',
      hp: 0,
      maxHp: 0,
      gold: 0,
      bag: {
        slots: 0,
        used: 0,
        items: []
      },
      newCodexEntries: [],
      events: []
    };

    this.add.text(48, 42, '返回结算', {
      fontSize: '30px',
      color: '#f2eee2'
    });

    this.add.text(48, 94, `结果：${this.getResultLabel(summary.result)}`, {
      fontSize: '18px',
      color: summary.result === 'death' ? '#ff9d8f' : '#99ffd8'
    });

    this.add.text(48, 130, `层级：第 ${summary.floor} 层 / 房间：${summary.roomId}`, {
      fontSize: '16px',
      color: '#d8d0c0'
    });

    this.add.text(48, 158, `HP：${summary.hp}/${summary.maxHp}    纸钱：${summary.gold}`, {
      fontSize: '16px',
      color: '#d8d0c0'
    });

    this.add.text(48, 204, `带回未鉴定装备：${summary.bag.used}/${summary.bag.slots}`, {
      fontSize: '18px',
      color: '#f2eee2'
    });

    if (summary.bag.items.length === 0) {
      this.add.text(70, 244, '无', {
        fontSize: '16px',
        color: '#8f887b'
      });
    } else {
      summary.bag.items.forEach((item, index) => {
        const y = 244 + index * 30;
        this.add.text(70, y, `${item.id}  品质边框：${item.quality}`, {
          fontSize: '16px',
          color: this.getQualityColor(item.quality)
        });
      });
    }

    if (summary.lostItems && summary.lostItems.length > 0) {
      const lostStartY = 244 + Math.max(summary.bag.items.length, 1) * 30 + 26;
      this.add.text(48, lostStartY, `死亡损失：${summary.lostItems.length} 件`, {
        fontSize: '18px',
        color: '#ff9d8f'
      });
      summary.lostItems.forEach((item, index) => {
        this.add.text(70, lostStartY + 38 + index * 30, `${item.id}  品质边框：${item.quality}`, {
          fontSize: '16px',
          color: this.getQualityColor(item.quality)
        });
      });
    }

    const codexY = 390;
    this.add.text(48, codexY, `本局新解锁图鉴：${summary.newCodexEntries.length}`, {
      fontSize: '18px',
      color: '#f2eee2'
    });
    if (summary.newCodexEntries.length === 0) {
      this.add.text(70, codexY + 36, '无', {
        fontSize: '16px',
        color: '#8f887b'
      });
    } else {
      summary.newCodexEntries.forEach((entry, index) => {
        this.add.text(70, codexY + 36 + index * 26, entry.type, {
          fontSize: '16px',
          color: '#69c0ff'
        });
      });
    }

    this.add.text(520, 94, `关键事件：${summary.events.length}`, {
      fontSize: '18px',
      color: '#f2eee2'
    });
    summary.events.slice(0, 10).forEach((event, index) => {
      this.add.text(520, 130 + index * 26, `${event.time}ms  ${ReplayFormatter.getEventLabel(event.type)}  ${ReplayFormatter.formatDetailsPreview(event.details)}`, {
        fontSize: '14px',
        color: '#d8d0c0'
      });
    });

    this.identifyText = this.add.text(48, 466, '按 I 鉴定并入库带回装备', {
      fontSize: '14px',
      color: '#ffd98a'
    });

    this.add.text(48, 500, '按 R 再放一局，按 I 鉴定，按 S 查看仓库，按 P 查看复盘，按 C 查看图鉴，按 ESC 返回策略编辑器', {
      fontSize: '14px',
      color: '#8f887b'
    });

    this.input.keyboard.on('keydown-R', () => {
      this.scene.start('DungeonScene');
    });
    this.input.keyboard.on('keydown-ESC', () => {
      this.scene.start('MenuScene');
    });
    this.input.keyboard.on('keydown-C', () => {
      this.scene.start('CodexScene');
    });
    this.input.keyboard.on('keydown-P', () => {
      this.scene.start('ReplayScene', summary);
    });
    this.input.keyboard.on('keydown-I', () => {
      this.identifyReturnedItems(summary);
    });
    this.input.keyboard.on('keydown-S', () => {
      this.scene.start('StorageScene');
    });
  }

  getQualityColor(quality) {
    const colors = {
      normal: '#c9c1b1',
      magic: '#8b6dff',
      rare: '#69c0ff',
      epic: '#c77dff',
      legendary: '#ffb347'
    };

    return colors[quality] || '#f2eee2';
  }

  getResultLabel(result) {
    if (result === 'retreat') {
      return '主动返回';
    }
    if (result === 'death') {
      return '死亡';
    }
    return result;
  }

  identifyReturnedItems(summary) {
    if (this.hasIdentified) {
      this.identifyText.setText(`已鉴定 ${this.identifiedItems.length} 件装备`);
      return;
    }

    this.identifiedItems = StorageSystem.identifyAndStore(summary.bag.items);
    this.hasIdentified = true;
    this.identifyText.setText(`已鉴定 ${this.identifiedItems.length} 件装备，并放入局外仓库`);
  }
}

window.ReturnScene = ReturnScene;
