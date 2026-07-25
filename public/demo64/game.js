/* GameRPG loader */
(function () {
  const script = document.createElement('script');
  script.src = './game-original.js?v=deer-saddle-v2';
  script.onerror = () => console.error('[GameRPG] Falha ao carregar o jogo principal.');
  document.head.appendChild(script);
})();
