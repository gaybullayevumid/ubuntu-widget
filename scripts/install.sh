#!/usr/bin/env bash
# Installs the extension for the current user only (no root needed):
#   1. copies the extension files to ~/.local/share/gnome-shell/extensions/<uuid>
#      (only that one directory is replaced; nothing else is touched)
#   2. compiles the GSettings schema inside the installed copy
# It does NOT enable the extension; see the printed instructions.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

command -v glib-compile-schemas >/dev/null || { echo "glib-compile-schemas not found (install libglib2.0-bin)" >&2; exit 1; }

echo "Installing '$UUID' to: $INSTALL_DIR"
rm -rf -- "${INSTALL_DIR:?}"
mkdir -p "$INSTALL_DIR"
cp -r "$PROJECT_DIR"/{metadata.json,extension.js,prefs.js,stylesheet.css,schemas,src} "$INSTALL_DIR/"
glib-compile-schemas --strict "$INSTALL_DIR/schemas"

cat <<MSG

Installed. Next steps:
  * Wayland (default on Ubuntu): log out and back in so GNOME Shell discovers the extension.
  * X11: press Alt+F2, type 'r', Enter.
  * Then enable it:   gnome-extensions enable $UUID
MSG
