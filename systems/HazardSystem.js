class HazardSystem {
  constructor(scene) {
    this.scene = scene;
  }

  applyHazardDamage() {
    const inSoftHazard = this.scene.hazardZone && Phaser.Geom.Rectangle.Contains(
      this.scene.hazardZone.getBounds(),
      this.scene.player.sprite.x,
      this.scene.player.sprite.y
    );
    const inDeathZone = this.scene.deathZone && Phaser.Geom.Rectangle.Contains(
      this.scene.deathZone.getBounds(),
      this.scene.player.sprite.x,
      this.scene.player.sprite.y
    );

    if (inSoftHazard && this.scene.player.hp > 35) {
      this.scene.player.hp = Math.max(
        35,
        this.scene.player.hp - 30 * (this.scene.game.loop.delta / 1000)
      );
    }

    if (inDeathZone && this.scene.player.hp > 0) {
      this.scene.player.hp = Math.max(
        0,
        this.scene.player.hp - 55 * (this.scene.game.loop.delta / 1000)
      );
    }
  }

  checkDeath() {
    if (this.scene.isRunComplete || this.scene.player.hp > 0) {
      return;
    }

    this.scene.isRunComplete = true;
    this.scene.isRetreating = false;
    this.scene.isEncounterLocked = true;
    const summary = this.scene.createRunSummary('death');
    this.scene.showStatus('DEATH resolved: run ended');
    this.scene.addLog('DEATH resolved');
    this.scene.time.delayedCall(650, () => {
      this.scene.scene.start('ReturnScene', summary);
    });
  }
}

globalThis.HazardSystem = HazardSystem;
