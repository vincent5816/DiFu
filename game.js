(function () {
  const config = {
    type: Phaser.AUTO,
    parent: 'game',
    width: 960,
    height: 540,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    backgroundColor: '#17171c',
    dom: {
      createContainer: true
    },
    scene: [
      BootScene,
      MenuScene,
      DungeonScene,
      ReturnScene,
      ReplayScene,
      CodexScene,
      StorageScene
    ]
  };

  window.game = new Phaser.Game(config);
})();
