class LootSystem {
  constructor(scene) {
    this.scene = scene;
    this.lootCounter = 1;
    this.paperMoneyCounter = 1;
  }

  spawnLoot(x, y) {
    const entityId = `loot_${String(this.lootCounter).padStart(3, '0')}`;
    const itemId = `item_drop_${String(this.lootCounter).padStart(3, '0')}`;
    this.lootCounter += 1;
    const item = this.scene.equipmentSystem
      ? this.scene.equipmentSystem.createRandomItem(itemId)
      : { id: itemId, kind: 'equipment', quality: 'magic', slot: 'weapon', affixes: [] };
    const qualityConfig = EquipmentData.qualities[item.quality] || EquipmentData.qualities.magic;

    const loot = {
      id: entityId,
      itemId,
      kind: 'loot',
      type: 'unidentified_equipment',
      quality: item.quality,
      item,
      active: true,
      sprite: this.scene.add.rectangle(x + 48, y, 24, 24, qualityConfig.tint),
      label: this.scene.add.text(x + 18, y + 34, `${qualityConfig.name} ${item.slot}`, {
        fontSize: '14px',
        color: qualityConfig.color
      })
    };

    this.scene.entities.push(loot);
    this.scene.isRunComplete = false;
    this.scene.addLog(`Loot spawned: ${entityId} ${item.quality} ${item.slot}`);
    return loot;
  }

  spawnPaperMoney(x, y, amount = null) {
    const entityId = `paper_money_${String(this.paperMoneyCounter).padStart(3, '0')}`;
    this.paperMoneyCounter += 1;
    const value = Number.isFinite(amount)
      ? Math.max(1, Math.round(amount))
      : Phaser.Math.Between(3, 5);

    const sprite = this.scene.add.rectangle(x - 36, y + 8, 30, 18, 0xd8c08f, 0.95)
      .setStrokeStyle(1, 0x8f6b2d, 0.9);
    const shine = this.scene.add.rectangle(x - 30, y + 3, 16, 3, 0xfff0b8, 0.85);
    const label = this.scene.add.text(x - 55, y + 28, `纸钱 +${value}`, {
      fontSize: '13px',
      color: '#ffd98a'
    });

    const paperMoney = {
      id: entityId,
      kind: 'paper_money',
      type: 'paper_money',
      amount: value,
      active: true,
      encounterRadius: 96,
      sprite,
      label,
      visuals: [shine]
    };

    this.scene.entities.push(paperMoney);
    this.scene.isRunComplete = false;
    this.scene.recordRunEvent('PAPER_MONEY_DROPPED', {
      entityId,
      amount: value
    });
    this.scene.addLog(`Paper money dropped: ${entityId} +${value}`);
    return paperMoney;
  }
}

globalThis.LootSystem = LootSystem;
