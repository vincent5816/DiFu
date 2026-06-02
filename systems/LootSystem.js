class LootSystem {
  constructor(scene) {
    this.scene = scene;
    this.lootCounter = 1;
  }

  spawnLoot(x, y) {
    const entityId = `loot_${String(this.lootCounter).padStart(3, '0')}`;
    const itemId = `item_drop_${String(this.lootCounter).padStart(3, '0')}`;
    this.lootCounter += 1;

    const loot = {
      id: entityId,
      itemId,
      kind: 'loot',
      type: 'unidentified_equipment',
      quality: 'magic',
      active: true,
      sprite: this.scene.add.rectangle(x + 48, y, 24, 24, 0x8b6dff),
      label: this.scene.add.text(x + 26, y + 34, '掉落', {
        fontSize: '14px',
        color: '#c9b8ff'
      })
    };

    this.scene.entities.push(loot);
    this.scene.isRunComplete = false;
    this.scene.addLog(`Loot spawned: ${entityId}`);
    return loot;
  }
}

globalThis.LootSystem = LootSystem;
