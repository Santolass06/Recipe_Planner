// Câmara do scanner só faz sentido num ecrã que se aponta a um papel —
// telemóvel ou tablet. Em desktop (Linux/Windows/macOS) só upload de
// ficheiro faz sentido.
//
// Lógica pura e exportada à parte de isMobileDevice() para poder ser
// verificada sem DOM — ver o self-check em platform.selfcheck.mjs (`node
// src/lib/platform.selfcheck.mjs`). Editar aqui exige editar lá também.
export function detectMobile(userAgent: string, platform: string, maxTouchPoints: number): boolean {
  if (/android|iphone|ipod|ipad/i.test(userAgent)) return true;
  // iPadOS 13+ reporta-se como Safari de desktop (UA de Mac); só o suporte
  // a toque o distingue de um Mac a sério, que não tem multi-touch.
  return platform === "MacIntel" && maxTouchPoints > 1;
}

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return detectMobile(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
}
