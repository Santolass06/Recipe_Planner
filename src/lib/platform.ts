// Câmara do scanner só faz sentido num ecrã que se aponta a um papel —
// telemóvel ou tablet. Em desktop (Linux/Windows/macOS) só upload de
// ficheiro faz sentido.
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/android|iphone|ipod|ipad/i.test(ua)) return true;
  // iPadOS 13+ reporta-se como Safari de desktop (UA de Mac); só o suporte
  // a toque o distingue de um Mac a sério, que não tem multi-touch.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}
