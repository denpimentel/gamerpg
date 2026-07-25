/* GameRPG loader */
(function () {
  const script = document.createElement('script');
  script.src = './game-original.js?v=lord-mas-v6';
  script.onerror = () => console.error('[GameRPG] Falha ao carregar o jogo principal.');
  document.head.appendChild(script);
})();
