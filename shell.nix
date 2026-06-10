{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShell {
  buildInputs = with pkgs; [
    pkg-config glib gtk3 webkitgtk_4_1
    librsvg libayatana-appindicator xdotool openssl
    gdk-pixbuf cairo pango atk mesa
  ];
  shellHook = ''
    export LD_LIBRARY_PATH=$(pkg-config --libs-only-L gtk+-3.0 webkit2gtk-4.1 glib-2.0 cairo pango atk gdk-pixbuf-2.0 2>/dev/null | tr ' ' '\n' | sed 's/-L//' | tr '\n' ':')$LD_LIBRARY_PATH
    export WEBKIT_DISABLE_COMPOSITING_MODE=1
    export WEBKIT_DISABLE_DMABUF_RENDERER=1
    export LIBGL_ALWAYS_SOFTWARE=1
    export EGL_PLATFORM=surfaceless
  '';
}
