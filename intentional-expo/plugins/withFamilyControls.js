/**
 * Expo config plugin for Apple FamilyControls (US-026).
 *
 * Responsibilities:
 *   1. Inject the FamilyControls entitlement so the OS grants access.
 *   2. Set minimum iOS deployment target to 16.0 (FamilyActivityPicker
 *      and Codable FamilyActivitySelection both require 16.0+).
 *
 * Applied during `eas build` / `expo prebuild` — not needed for Expo Go.
 */
const { withEntitlementsPlist, withInfoPlist, withXcodeProject } = require('@expo/config-plugins');

/**
 * @param {import('@expo/config-plugins').ExpoConfig} config
 */
function withFamilyControls(config) {
  // ── 1. Add the entitlement ───────────────────────────────────────────────
  config = withEntitlementsPlist(config, (cfg) => {
    cfg.modResults['com.apple.developer.family-controls'] = true;
    return cfg;
  });

  // ── 2. Ensure minimum iOS deployment target is 16.0 ─────────────────────
  //    FamilyActivityPicker + Codable FamilyActivitySelection = iOS 16+
  config = withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const targets = project.pbxNativeTargetSection();

    // Update IPHONEOS_DEPLOYMENT_TARGET in every configuration
    Object.values(project.pbxXCBuildConfigurationSection()).forEach((bc) => {
      if (typeof bc === 'object' && bc.buildSettings) {
        const current = bc.buildSettings.IPHONEOS_DEPLOYMENT_TARGET;
        // Only raise the floor — never lower it
        if (!current || parseFloat(current) < 16.0) {
          bc.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = '16.0';
        }
      }
    });

    return cfg;
  });

  return config;
}

module.exports = withFamilyControls;
