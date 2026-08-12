/**
 * withPodfilePatches.js — Expo config plugin
 *
 * Injects AccessBelt's post_install patches into the generated ios/Podfile
 * so they survive `npx expo prebuild --clean`.
 *
 * Patches:
 *   A. LastUpgradeCheck sync (silences Xcode "Update to recommended settings")
 *   B. Libtool no-symbols + nullability silencing
 *   C. fmt consteval fix for Apple Clang 21+ (TODO: remove at RN ≥ 0.83.9)
 *   D. Aggregate xcconfig cleanup (duplicate -lc++, TOOLCHAIN_DIR Swift path)
 */

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const BEGIN_MARKER = '# @generated begin accessbelt-podfile-patches';
const END_MARKER = '# @generated end accessbelt-podfile-patches';

/**
 * The Ruby code to inject into post_install, after react_native_post_install().
 * Each patch block preserves the original comments verbatim.
 */
const PATCHES_RUBY = `
${BEGIN_MARKER}
    # ── Patch A: LastUpgradeCheck sync ──────────────────────────────────
    # Match the app project's LastUpgradeCheck so Xcode doesn't prompt
    # "Update to recommended settings" for the generated Pods project.
    app_upgrade_check = installer.aggregate_targets
      .map { |t| t.user_project.root_object.attributes['LastUpgradeCheck'] }
      .compact.max
    installer.pods_project.root_object.attributes['LastUpgradeCheck'] = app_upgrade_check if app_upgrade_check

    # ── Patch B: Libtool + nullability silencing ───────────────────────
    # Silence harmless libtool warnings for object files that compile to
    # nothing on iOS (e.g. RCTConvert+CoreLocation.o, RCTConvert+Transform.o).
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['OTHER_LIBTOOLFLAGS'] = '-no_warning_for_no_symbols'
        # Expo/RN vendored headers mix annotated and unannotated pointers
        # (e.g. ExpoModulesCore's EXLegacyExpoViewProtocol.h), tripping
        # -Wnullability-completeness in every pod that imports them.
        config.build_settings['CLANG_WARN_NULLABILITY_COMPLETENESS'] = 'NO'
      end
    end

    # ── Patch C: fmt consteval fix ─────────────────────────────────────
    # fmt 11.x fails under Apple Clang 21+ (Xcode 26.4+) due to stricter consteval
    # rules (facebook/react-native#55601). Force FMT_USE_CONSTEVAL=0 on Apple Clang.
    # TODO: Remove once React Native bundles fmt >= 12.1.0 (RN 0.83.9+).
    fmt_base_h = File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base_h)
      contents = File.read(fmt_base_h)
      patched = contents.sub(
        "#elif defined(__apple_build_version__) && __apple_build_version__ < 14000029L\\n" \\
        "#  define FMT_USE_CONSTEVAL 0  // consteval is broken in Apple clang < 14.",
        "#elif defined(__apple_build_version__)\\n" \\
        "#  define FMT_USE_CONSTEVAL 0  // consteval is broken in Apple clang (see fmtlib/fmt#4740)."
      )
      File.write(fmt_base_h, patched) if patched != contents
    end

    # ── Patch D: Aggregate xcconfig cleanup ────────────────────────────
    # The app target's OTHER_LDFLAGS already links -lc++, so drop the
    # duplicate from the generated xcconfig (Xcode 15+ warns otherwise).
    # Also drop the $(TOOLCHAIN_DIR) Swift search path: with Xcode 26's
    # on-demand Metal toolchain, TOOLCHAIN_DIR can resolve to
    # Metal.xctoolchain, which has no usr/lib/swift/<platform>, producing a
    # "Search path not found" warning. It's only needed for pre-iOS 12.2
    # deployment targets.
    installer.aggregate_targets.each do |aggregate_target|
      aggregate_target.user_build_configurations.each_key do |config_name|
        xcconfig_path = aggregate_target.xcconfig_path(config_name)
        next unless File.exist?(xcconfig_path)
        contents = File.read(xcconfig_path)
        patched = contents
          .gsub(' -l"c++"', '')
          .gsub(' "\${TOOLCHAIN_DIR}/usr/lib/swift/\${PLATFORM_NAME}"', '')
        File.write(xcconfig_path, patched) if patched != contents
      end
    end
${END_MARKER}`;

/**
 * Find the closing paren + newline of react_native_post_install(...) in
 * the Podfile and inject our patches right after it.
 */
function injectPatches(podfileContents) {
  // Already injected? Strip old version first for idempotency.
  const stripped = stripExistingPatches(podfileContents);

  // Find the react_native_post_install block. Expo's generated Podfile
  // calls it as:
  //   react_native_post_install(
  //     installer,
  //     ...
  //   )
  // We look for the closing ")" of that call. It sits on its own line
  // (with leading whitespace and a trailing newline).
  const rnPostInstallRegex = /react_native_post_install\([\s\S]*?\n(\s*)\)/;
  const match = stripped.match(rnPostInstallRegex);

  if (!match) {
    console.warn(
      '[withPodfilePatches] Could not find react_native_post_install() in Podfile. ' +
      'Patches were NOT injected. The Podfile may have changed structure.'
    );
    return stripped;
  }

  const insertIndex = match.index + match[0].length;
  const before = stripped.slice(0, insertIndex);
  const after = stripped.slice(insertIndex);

  return before + '\n' + PATCHES_RUBY + after;
}

/**
 * Remove any previously injected patch block (idempotency).
 */
function stripExistingPatches(contents) {
  const beginIdx = contents.indexOf(BEGIN_MARKER);
  if (beginIdx === -1) return contents;

  const endIdx = contents.indexOf(END_MARKER);
  if (endIdx === -1) return contents;

  // Include the full END_MARKER line
  const endOfMarker = endIdx + END_MARKER.length;
  // Consume the trailing newline if present
  const nextChar = contents[endOfMarker];
  const sliceEnd = nextChar === '\n' ? endOfMarker + 1 : endOfMarker;

  // Also consume a leading newline before BEGIN_MARKER
  const sliceStart = beginIdx > 0 && contents[beginIdx - 1] === '\n'
    ? beginIdx - 1
    : beginIdx;

  return contents.slice(0, sliceStart) + contents.slice(sliceEnd);
}

/**
 * The Expo config plugin entry point.
 */
const withPodfilePatches = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');

      if (!fs.existsSync(podfilePath)) {
        console.warn(
          '[withPodfilePatches] ios/Podfile not found at:', podfilePath,
          '— skipping patch injection.'
        );
        return cfg;
      }

      const original = fs.readFileSync(podfilePath, 'utf-8');
      const patched = injectPatches(original);

      if (patched !== original) {
        fs.writeFileSync(podfilePath, patched, 'utf-8');
        console.log('[withPodfilePatches] ✅ Injected post_install patches into ios/Podfile');
      } else {
        console.log('[withPodfilePatches] Podfile already patched or unchanged.');
      }

      return cfg;
    },
  ]);
};

module.exports = withPodfilePatches;
