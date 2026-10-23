/**
 * Expo config plugin for Apple FamilyControls (US-026).
 *
 * Responsibilities:
 *   1. Inject the FamilyControls entitlement so the OS grants access.
 *   1b. US-077: add the App Group shared with the DeviceActivityMonitor
 *       extension (targets/device-activity-monitor), which reads the app
 *       selection from it when a strict habit's window starts.
 *   2. Set minimum iOS deployment target to 16.0 (FamilyActivityPicker
 *      and Codable FamilyActivitySelection both require 16.0+), in the
 *      Xcode project and in the Podfile (the local module pod needs 16.0).
 *
 * Applied during `eas build` / `expo prebuild` — not needed for Expo Go.
 */
const { withEntitlementsPlist, withPodfileProperties, withXcodeProject } = require('@expo/config-plugins');

const FAMILY_CONTROLS = 'com.apple.developer.family-controls';
const APP_GROUPS = 'com.apple.security.application-groups';
/** Must match modules/family-controls/ios/FamilyControlsModule.swift and the extension. */
const APP_GROUP = 'group.com.intentional.app';

function addGroup(list) {
  const groups = Array.isArray(list) ? [...list] : [];
  if (!groups.includes(APP_GROUP)) groups.push(APP_GROUP);
  return groups;
}

/**
 * @param {import('@expo/config-plugins').ExpoConfig} config
 */
function withFamilyControls(config) {
  // ── 1. Add the entitlement ───────────────────────────────────────────────
  // Also written to ios.entitlements so EAS credentials and @bacons/apple-targets see the group.
  config.ios = config.ios || {};
  config.ios.entitlements = {
    ...(config.ios.entitlements || {}),
    [FAMILY_CONTROLS]: true,
    [APP_GROUPS]: addGroup(config.ios.entitlements && config.ios.entitlements[APP_GROUPS]),
  };
  config = withEntitlementsPlist(config, (cfg) => {
    cfg.modResults[FAMILY_CONTROLS] = true;
    cfg.modResults[APP_GROUPS] = addGroup(cfg.modResults[APP_GROUPS]);
    return cfg;
  });

  // ── 2. Ensure minimum iOS deployment target is 16.0 ─────────────────────
  //    FamilyActivityPicker + Codable FamilyActivitySelection = iOS 16+
  config = withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;

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

  // Only raise an explicit lower value: when unset, the Podfile default (16.4 in SDK 57) already
  // satisfies the local module pod, and writing 16.0 would LOWER it below React Native's minimum.
  config = withPodfileProperties(config, (cfg) => {
    const current = cfg.modResults['ios.deploymentTarget'];
    if (current && parseFloat(current) < 16.0) cfg.modResults['ios.deploymentTarget'] = '16.0';
    return cfg;
  });

  return config;
}

module.exports = withFamilyControls;
