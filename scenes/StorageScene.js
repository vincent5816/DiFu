class StorageScene extends Phaser.Scene {
  constructor() {
    super('StorageScene');
  }

  create() {
    const items = StorageSystem.getItems();

    this.add.text(48, 42, '局外仓库', {
      fontSize: '30px',
      color: '#f2eee2'
    });

    if (items.length === 0) {
      this.add.text(48, 104, '暂无已鉴定装备', {
        fontSize: '16px',
        color: '#8f887b'
      });
    } else {
      items.slice(0, 12).forEach((item, index) => {
        const affixText = item.affixes.map((affix) => `${affix.type} T${affix.tier}`).join(', ');
        this.add.text(
          48,
          104 + index * 34,
          `${item.id}  ${item.quality}  ${item.slot}  ${affixText}`,
          {
            fontSize: '15px',
            color: this.getQualityColor(item.quality)
          }
        );
      });
    }

    this.add.text(48, 500, '按 ESC 返回策略编辑器', {
      fontSize: '14px',
      color: '#8f887b'
    });

    this.input.keyboard.on('keydown-ESC', () => {
      this.scene.start('MenuScene');
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
}

globalThis.StorageScene = StorageScene;
