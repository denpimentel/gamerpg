/* GameRPG loader */
(function () {
  const script = document.createElement('script');
  script.src = './game-original.js?v=deer-knockback-v1';
  script.onerror = () => console.error('[GameRPG] Falha ao carregar o jogo principal.');
  document.head.appendChild(script);
})();
