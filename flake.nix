{
  description = "Thumbnailer — client-side thumbnail generation (PDF, PostScript, TIFF) for WordPress";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";

    # Composer -> Nix. Reads composer.lock per-package, so there is no vendored
    # dependency hash to keep in sync.
    composition-c4.url = "github:fossar/composition-c4";

    git-hooks.url = "github:cachix/git-hooks.nix";

    # Keeps playwright-driver and the browsers pinned to the same release as the
    # @playwright/test npm package. nixpkgs makes no such guarantee, and a
    # driver/runner mismatch surfaces as an unrelated-looking protocol error.
    playwright.url = "github:pietdevries94/playwright-web-flake";

    # UTIF.js is a plain source tree, not an npm package worth using: the
    # `utif` package on npm is v3.1.0 from 2019, well behind master. It used to
    # be a git submodule, which was invisible to `self` here and absent from any
    # plain checkout. As a flake input it is pinned by flake.lock, bumped by
    # Dependabot's `nix` ecosystem, and — crucially — symlinked into place by
    # BOTH the derivations below and the dev shell, so `nix build` and
    # `nix develop` can never resolve different sources.
    utif = {
      url = "github:photopea/UTIF.js";
      flake = false;
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      composition-c4,
      git-hooks,
      playwright,
      utif,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [
            composition-c4.overlays.default
            (_final: _prev: {
              inherit (playwright.packages.${system}) playwright-test playwright-driver;
            })
          ];
        };

        inherit (pkgs) lib;

        php = pkgs.php84.buildEnv {
          extensions = (
            { enabled, all }:
            enabled
            ++ (with all; [
              mbstring
              tokenizer
              fileinfo
            ])
          );
          # PHPStan parses the full WordPress stubs; 128M is not enough.
          extraConfig = ''
            memory_limit = 2G
          '';
        };

        nodejs = pkgs.nodejs_22;

        # package.json is the single source of truth for the version:
        # release-please bumps it natively and propagates everywhere else.
        packageData = builtins.fromJSON (builtins.readFile ./package.json);

        pname = "thumbnailer";
        version = packageData.version;
        src = self;

        composerDeps = pkgs.c4.fetchComposerDeps { inherit src; };
        npmDeps = pkgs.importNpmLock.importNpmLock { npmRoot = ./.; };

        # src/worker.ts imports ../third-party/utif/UTIF.js. Run identically in
        # every derivation's postPatch and in the dev shell's shellHook.
        linkUtif = ''
          mkdir -p third-party
          ln -sfn ${utif} third-party/utif
        '';

        # The Playwright runner comes from Nix, so the spec files must resolve
        # @playwright/test to that *same* copy. Two instances — npm's, from
        # package-lock.json, and Nix's — make every test.afterEach() throw
        # "did not expect ... to be called here" at load time, which the
        # reporters swallow; the run then exits 0 having collected zero tests.
        # A green check that ran nothing is indistinguishable from a pass, so
        # playwright.config.ts also asserts a non-zero test count.
        linkNixPlaywright = ''
          rm -rf node_modules/@playwright/test node_modules/playwright node_modules/playwright-core
          mkdir -p node_modules/@playwright
          ln -s ${pkgs.playwright-test}/lib/node_modules/@playwright/test node_modules/@playwright/test
          ln -s ${pkgs.playwright-test}/lib/node_modules/playwright node_modules/playwright
          ln -s ${pkgs.playwright-test}/lib/node_modules/playwright-core node_modules/playwright-core
        '';

        playwrightEnv = {
          PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
          PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
          PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
          PLAYWRIGHT_NODEJS_PATH = "${nodejs}/bin/node";
        };

        nodeBuildInputs = [
          nodejs
          pkgs.importNpmLock.npmConfigHook
        ];

        phpBuildInputs = [
          php
          php.packages.composer
          pkgs.c4.composerSetupHook
        ];

        # ── The plugin ────────────────────────────────────────────────────────
        pluginPackage = pkgs.stdenvNoCC.mkDerivation {
          inherit
            pname
            version
            src
            composerDeps
            npmDeps
            ;

          nativeBuildInputs = phpBuildInputs ++ nodeBuildInputs;

          postPatch = linkUtif;

          buildPhase = ''
            runHook preBuild
            composer --no-ansi install --no-dev --no-interaction --optimize-autoloader
            npm run build
            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall

            pluginDir="$out/share/wordpress/plugins/${pname}"
            mkdir -p "$pluginDir/src"

            cp thumbnailer.php readme.txt README.md LICENSE "$pluginDir/"

            # -L dereferences: composition-c4 installs vendor/ as symlinks into
            # the Nix store, and a distributable zip must carry real files.
            cp -rL dist vendor "$pluginDir/"
            cp -rL src/php "$pluginDir/src/php"

            # Sourcemaps are ~1.6 MB and useless in an installed plugin; the
            # .d.ts tree exists for the npm package, not for WordPress.
            rm -f "$pluginDir/dist/"*.map "$pluginDir/dist/"*.d.ts

            # Re-stamp the version from package.json. A source checkout between
            # releases can carry a stale literal; the built artifact never does.
            sed -i -E "s|^([[:space:]]*\*[[:space:]]*Version:[[:space:]]*).*|\1${version}|" \
              "$pluginDir/thumbnailer.php"
            sed -i -E "s|(define\('THUMBNAILER_VERSION',[[:space:]]*')[^']*(')|\1${version}\2|" \
              "$pluginDir/thumbnailer.php"
            sed -i -E "s|^(Stable tag:[[:space:]]*).*|\1${version}|" "$pluginDir/readme.txt"
            # Strip release-please's markers from the shipped readme.
            sed -i -E "/^x-release-please-(start-version|end)$/d" "$pluginDir/readme.txt"

            runHook postInstall
          '';

          meta = {
            inherit (packageData) description;
            homepage = "https://github.com/Avunu/thumbnailer";
            license = lib.licenses.agpl3Only;
            platforms = lib.platforms.all;
          };
        };

        zip = pkgs.stdenvNoCC.mkDerivation {
          name = "${pname}-zip-${version}";
          nativeBuildInputs = [ pkgs.zip ];
          dontUnpack = true;
          buildCommand = ''
            mkdir -p tmp/${pname}
            cp -r ${pluginPackage}/share/wordpress/plugins/${pname}/. tmp/${pname}/
            chmod -R u+w tmp
            mkdir -p "$out"
            # -X strips extra file attributes, for a reproducible archive.
            (cd tmp && zip -qr -X "$out/${pname}.zip" ${pname})
          '';
        };

        # ── Checks ────────────────────────────────────────────────────────────
        # A check that needs node_modules gets npmDeps; one that needs vendor/
        # gets composerDeps. Both are offline, so every check below runs in the
        # sandbox with no network.
        nodeCheck =
          name: extraAttrs:
          pkgs.stdenvNoCC.mkDerivation (
            {
              name = "${pname}-${name}-${version}";
              inherit src npmDeps;
              nativeBuildInputs = nodeBuildInputs;
              postPatch = linkUtif;
              installPhase = "touch $out";
            }
            // extraAttrs
          );

        phpCheck =
          name: buildPhase:
          pkgs.stdenvNoCC.mkDerivation {
            name = "${pname}-${name}-${version}";
            inherit src composerDeps;
            nativeBuildInputs = phpBuildInputs ++ [ pkgs.phpstan ];
            inherit buildPhase;
            installPhase = "touch $out";
          };

        preCommitCheck = git-hooks.lib.${system}.run {
          inherit src;
          hooks = {
            # PHPStan needs vendor/ and the npm gate needs node_modules, neither
            # of which exists in the read-only `nix flake check` sandbox. Running
            # them at pre-push means the dev shell installs them locally while
            # the sandboxed flake check still validates the hook config itself.
            # Both entries are absolute store paths, and the npm one exports its
            # own PATH. A hook runs in whatever environment `git push` had, which
            # is generally not the dev shell — going through `composer phpstan`
            # here meant the hook died with "phpstan: command not found" for
            # anyone pushing from a plain terminal.
            phpstan = {
              enable = true;
              name = "phpstan (level 8, WordPress-aware)";
              package = pkgs.phpstan;
              entry = "${pkgs.phpstan}/bin/phpstan analyse --no-progress --no-ansi --memory-limit=2G";
              files = "\\.php$";
              pass_filenames = false;
              stages = [ "pre-push" ];
            };
            assets-check = {
              enable = true;
              name = "asset checks (oxfmt + oxlint + tsc + versions)";
              entry = toString (
                pkgs.writeShellScript "thumbnailer-assets-check" ''
                  export PATH="${lib.makeBinPath [ nodejs ]}:$PATH"
                  exec npm run check
                ''
              );
              files = "\\.(ts|mjs|json)$";
              pass_filenames = false;
              stages = [ "pre-push" ];
            };
          };
        };
      in
      {
        packages = {
          default = pluginPackage;
          inherit zip;
          plugin = pluginPackage;
        };

        checks = {
          pre-commit = preCommitCheck;

          static = nodeCheck "static" {
            buildPhase = ''
              runHook preBuild
              npm run format:check
              npm run lint
              npm run lint:typecheck
              npm run typecheck
              node scripts/check-versions.mjs
              runHook postBuild
            '';
          };

          vitest = nodeCheck "vitest" {
            buildPhase = ''
              runHook preBuild
              npm test
              runHook postBuild
            '';
          };

          browser = nodeCheck "browser" (
            playwrightEnv
            // {
              nativeBuildInputs = nodeBuildInputs ++ [ pkgs.playwright-test ];
              buildPhase = ''
                runHook preBuild
                export HOME="$TMPDIR"
                npm run build
                ${linkNixPlaywright}
                npm run test:browser
                runHook postBuild
              '';
            }
          );

          phpstan = phpCheck "phpstan" ''
            runHook preBuild
            composer --no-ansi install --no-interaction
            phpstan analyse --no-progress --no-ansi --memory-limit=2G
            runHook postBuild
          '';

          phpunit = phpCheck "phpunit" ''
            runHook preBuild
            composer --no-ansi install --no-interaction
            php vendor/bin/phpunit --no-coverage --colors=never
            runHook postBuild
          '';
        };

        devShells.default = pkgs.mkShell (
          playwrightEnv
          // {
            packages = [
              php
              php.packages.composer
              pkgs.phpstan
              nodejs
              pkgs.playwright-test
              pkgs.zip
              # tests/playground/run.mjs extracts the release zip before
              # mounting it into WordPress.
              pkgs.unzip
            ]
            ++ preCommitCheck.enabledPackages;

            # Installs the git hooks, then makes the same UTIF symlink the
            # derivations do — so a bare `nix develop` yields a checkout that
            # builds, with no manual vendoring step.
            shellHook = ''
              ${preCommitCheck.shellHook}
              ${linkUtif}
              echo "thumbnailer: third-party/utif linked from the flake pin."
            '';
          }
        );

        formatter = pkgs.nixfmt-rfc-style;
      }
    );
}
