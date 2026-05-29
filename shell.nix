{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.nodejs_24  
    pkgs.nodePackages.npm 
  ];

  shellHook = ''
    echo "nodejs shell.nix"
    node --version
  '';
}