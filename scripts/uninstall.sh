#!/usr/bin/env bash
# Disables the extension and removes ONLY its own directory under
# ~/.local/share/gnome-shell/extensions/<uuid>. Settings stored in dconf are left in place;
# the last line prints how to reset them if you want.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

command -v gnome-extensions >/dev/null && gnome-extensions disable "$UUID" 2>/dev/null || true

if [[ -d "$INSTALL_DIR" ]]; then
    # Safety check: only delete a directory that really is this extension.
    if grep -q "\"$UUID\"" "$INSTALL_DIR/metadata.json" 2>/dev/null; then
        rm -rf -- "${INSTALL_DIR:?}"
        echo "Removed $INSTALL_DIR"
    else
        echo "Refusing to delete $INSTALL_DIR: metadata.json does not match '$UUID'" >&2
        exit 1
    fi
else
    echo "Nothing to remove: $INSTALL_DIR does not exist"
fi
echo "Optional: reset saved settings with:  dconf reset -f /org/gnome/shell/extensions/systemmonitor/"
