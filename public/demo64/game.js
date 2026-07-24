/* GameRPG loader — basic Death Knight test. */
(function () {
  const load = (src, done) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = done || null;
    script.onerror = () => console.error('[GameRPG] Falha ao carregar:', src);
    document.head.appendChild(script);
  };

  load('./death-knight-basic.js?v=1', () => {
    const ready = window.__deathKnightReady || Promise.resolve();
    Promise.resolve(ready)
      .catch(error => console.error('[DeathKnight] Falha no processamento:', error))
      .finally(() => load('./game-original.js?v=1'));
  });
})();