(function () {
  const baseWidth = 960;
  const baseHeight = 540;
  const devicePixelRatio = window.devicePixelRatio || 1;
  const parent = document.getElementById('game');
  const parentWidth = (parent && parent.clientWidth) || window.innerWidth || baseWidth;
  const parentHeight = (parent && parent.clientHeight) || window.innerHeight || baseHeight;
  const fitScale = Math.min(parentWidth / baseWidth, parentHeight / baseHeight);
  const renderResolution = Math.min(Math.max(devicePixelRatio, fitScale * devicePixelRatio), 3);

  const config = {
    type: Phaser.AUTO,
    parent: 'game',
    width: baseWidth,
    height: baseHeight,
    resolution: renderResolution,
    pixelArt: false,
    antialias: true,
    antialiasGL: true,
    roundPixels: false,
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
      SkillConfigScene,
      StorageScene
    ]
  };

  window.game = new Phaser.Game(config);
})();
