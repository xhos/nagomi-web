{
  nixConfig = {
    extra-substituters = ["https://nix-community.cachix.org"];
    extra-trusted-public-keys = ["nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs="];
  };

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    git-hooks.url = "github:cachix/git-hooks.nix";
    git-hooks.inputs.nixpkgs.follows = "nixpkgs";
    bun2nix.url = "github:nix-community/bun2nix";
    bun2nix.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = {
    self,
    nixpkgs,
    git-hooks,
    bun2nix,
  }: let
    systems = ["x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin"];
    forAllSystems = f:
      nixpkgs.lib.genAttrs systems (system:
        f system (import nixpkgs {
          inherit system;
          overlays = [bun2nix.overlays.default];
        }));
  in {
    checks = forAllSystems (system: pkgs: {
      pre-commit = git-hooks.lib.${system}.run {
        src = ./.;
        hooks = {
          # bun2nix rewrites bun.nix on every install; keep alejandra off it
          alejandra = {
            enable = true;
            excludes = ["bun\\.nix"];
          };
          biome.enable = true;

          typecheck = {
            enable = true;
            entry = pkgs.lib.getExe (pkgs.writeShellApplication {
              name = "tsc-check";
              runtimeInputs = [pkgs.bun];
              text = "bun tsc --noEmit";
            });
            stages = ["pre-push"];
            pass_filenames = false;
            files = "\\.(ts|tsx)$";
          };

          nix-build = {
            enable = true;
            entry = pkgs.lib.getExe (pkgs.writeShellApplication {
              name = "nix-build-check";
              runtimeInputs = [pkgs.nix];
              text = "nix build --no-link";
            });
            stages = ["pre-push"];
            pass_filenames = false;
            files = "(package\\.json|bun\\.lock|bun\\.nix|flake\\.nix)";
          };
        };
      };
    });

    packages = forAllSystems (system: pkgs: {
      default = pkgs.bun2nix.writeBunApplication {
        packageJson = ./package.json;
        src = ./.;
        buildPhase = "bun run build";
        startScript = "bun run start";
        bunDeps = pkgs.bun2nix.fetchBunDeps {
          bunNix = ./bun.nix;
        };
      };
    });

    devShells = forAllSystems (system: pkgs: {
      default = pkgs.mkShell {
        packages = with pkgs; [
          bun
          bun2nix.packages.${system}.default
          nodejs
          biome

          (writeShellScriptBin "run" ''
            ${bun}/bin/bun install
            exec ${bun}/bin/bun run dev
          '')

          (writeShellScriptBin "demo" ''
            ${bun}/bin/bun install
            exec ${bun}/bin/bun run demo
          '')

          (writeShellScriptBin "regen" ''
            rm -rf src/gen
            exec ${bun}/bin/bun buf generate
          '')

          (writeShellScriptBin "bump-protos" ''
            set -e
            git submodule update --remote --checkout proto
            git add proto
            git commit -m "chore: bump protos"
            git push
          '')
        ];

        shellHook = self.checks.${system}.pre-commit.shellHook;
      };
    });

    formatter = forAllSystems (system: pkgs: pkgs.alejandra);
  };
}
