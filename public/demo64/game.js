/* GameRPG loader */
(function () {
  const script = document.createElement('script');
  script.src = './game-original.js?v=ogre-size-drop-test-v1';
  script.onerror = () => console.error('[GameRPG] Falha ao carregar o jogo principal.');
  document.head.appendChild(script);
})();
