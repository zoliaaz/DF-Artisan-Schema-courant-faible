/* Schémas interphone / portail (version autonome) : chargé en premier. Il n'y a pas de serveur DF artisan : les
 * appels directs à /api/… faits au chargement (vie, réseau…) reçoivent une réponse vide au lieu d'une erreur. */
window.SCHEMAS_AUTONOMES = true; // (schemas.js : sans clients ni devis, sans la documentation de DF artisan)
(() => {
  const vers = s => /\/api\//.test(String((s && s.url) || s));
  const f = window.fetch.bind(window);
  window.fetch = (u, o) =>
    vers(u) ? Promise.resolve(new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } })) : f(u, o);
  if (navigator.sendBeacon) {
    const b = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (u, d) => (vers(u) ? true : b(u, d));
  }
})();
