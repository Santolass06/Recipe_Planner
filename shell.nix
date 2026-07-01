{ pkgs ? import <nixpkgs> {} }:
let
  # nixGL: Mesa/EGL do Nix não está ligado ao driver Intel iris do sistema em
  # Ubuntu não-NixOS. Sem isto, eglinfo mostra strings vazias (sem extensões)
  # e o WebKitGTK aborta com EGL_BAD_PARAMETER ao arrancar a janela. O
  # nixGLIntel liga o Mesa/EGL empacotado pelo Nix ao driver iris do sistema,
  # exportando GBM_BACKENDS_PATH, LIBGL_DRIVERS_PATH, LIBVA_DRIVERS_PATH,
  # __EGL_VENDOR_LIBRARY_FILENAMES e LD_LIBRARY_PATH com os caminhos
  # /nix/store/... corretos.
  #
  # Fixado ao commit b6105297e6f0cd041670c3e8628394d4ee247ed5 do nixGL para
  # builds reprodutíveis (em vez de "main", que muda com o tempo e quebraria
  # builds reprodutíveis). Repo: https://github.com/nix-community/nixGL
  nixGL = import (builtins.fetchTarball {
    url = "https://github.com/nix-community/nixGL/archive/b6105297e6f0cd041670c3e8628394d4ee247ed5.tar.gz";
    sha256 = "1zv3bshk0l4hfh1s7s3jzwjxl0nqqcvc4a3kydd3d4lgh7651d3x";
  }) {};
  nixGLIntel = nixGL.nixGLIntel;
in
pkgs.mkShell {
  buildInputs = with pkgs; [
    pkg-config glib gtk3 webkitgtk_4_1
    librsvg libayatana-appindicator xdotool openssl
    gdk-pixbuf cairo pango atk mesa
  ] ++ [ nixGLIntel ];
  shellHook = ''
    export LD_LIBRARY_PATH=$(pkg-config --libs-only-L gtk+-3.0 webkit2gtk-4.1 glib-2.0 cairo pango atk gdk-pixbuf-2.0 2>/dev/null | tr ' ' '\n' | sed 's/-L//' | tr '\n' ':')$LD_LIBRARY_PATH
    export WEBKIT_DISABLE_COMPOSITING_MODE=1
    export WEBKIT_DISABLE_DMABUF_RENDERER=1

    # nixGL: inject the same env vars that nixGLIntel exports (Mesa/EGL +
    # Intel iris driver paths from the fixed nixGL build), so WebKitGTK can
    # use the Intel iris driver without needing to prefix nixGLIntel manually.
    # Source the wrapper's export lines (drop the trailing `exec "$@"`).
    eval "$(sed '/^exec /d' ${nixGLIntel}/bin/nixGLIntel)"
  '';
}
