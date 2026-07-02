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
    glib-networking cacert
  ] ++ [ nixGLIntel ];
  shellHook = ''
        # LD_LIBRARY_PATH: expõe os dirs /lib das deps GTK/webkit/etc. do Nix para
    # o loader encontrar as .so em runtime (o binário Rust fica com um RUNPATH
    # efémero de nix-shell que aponta para um path inexistente, por isso
    # dependemos do LD_LIBRARY_PATH para resolver as libs dinâmicas).
    # openssl é necessário porque o binário (via libsql/Turso) liga
    # dinamicamente contra libssl.so.3/libcrypto.so.3; sem esta entrada, o
    # arranque aborta com "libssl.so.3: cannot open shared object file".
    export LD_LIBRARY_PATH=$(pkg-config --libs-only-L gtk+-3.0 webkit2gtk-4.1 glib-2.0 cairo pango atk gdk-pixbuf-2.0 openssl 2>/dev/null | tr ' ' '\n' | sed 's/-L//' | tr '\n' ':')$LD_LIBRARY_PATH
    export WEBKIT_DISABLE_COMPOSITING_MODE=1
    export WEBKIT_DISABLE_DMABUF_RENDERER=1

    # TLS: WebKitGTK (libsoup/GIO) precisa do backend TLS do glib-networking
    # para carregar https (ex.: fonts.googleapis.com). Sem ele, DevTools mostra
    # "TLS support is not available". cacert fornece os certificados raiz;
    # sem eles, mesmo com glib-networking, o TLS não valida nenhum certificado.
    export SSL_CERT_FILE="${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
    export NIX_SSL_CERT_FILE="${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
    # GIO precisa de saber onde está o módulo TLS (libgiognutls.so) do
    # glib-networking; sem GIO_EXTRA_MODULES, o módulo não é carregado e o
    # WebKitGTK continua a mostrar "TLS support is not available".
    export GIO_EXTRA_MODULES="${pkgs.glib-networking}/lib/gio/modules"

    # nixGL: inject the same env vars that nixGLIntel exports (Mesa/EGL +
    # Intel iris driver paths from the fixed nixGL build), so WebKitGTK can
    # use the Intel iris driver without needing to prefix nixGLIntel manually.
    # Source the wrapper's export lines (drop the trailing `exec "$@"`).
    eval "$(sed '/^exec /d' ${nixGLIntel}/bin/nixGLIntel)"
  '';
}
