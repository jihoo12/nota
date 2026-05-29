{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.electron
    pkgs.nodejs_24
    pkgs.nodePackages.npm 
  ];

  shellHook = ''
    echo "nodejs shell.nix"
    node --version
    export ELECTRON_OVERRIDE_DIST_PATH=${pkgs.electron}/bin
    export ELECTRON_SKIP_BINARY_DOWNLOAD=1
  '';
}
