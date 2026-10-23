/**
 * US-077 strict mode: DeviceActivityMonitor app extension (built by @bacons/apple-targets at prebuild).
 *
 * iOS runs this extension at a strict habit's start/end time, even when Intentional is closed,
 * and it shields / un-shields the apps the person picked. It reads the selection from the shared
 * App Group written by modules/family-controls (setSharedSelection).
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = () => ({
  type: 'device-activity-monitor',
  name: 'DeviceActivityMonitor',
  bundleIdentifier: '.DeviceActivityMonitor',
  deploymentTarget: '16.0',
  frameworks: ['DeviceActivity', 'FamilyControls', 'ManagedSettings'],
  entitlements: {
    'com.apple.developer.family-controls': true,
    'com.apple.security.application-groups': ['group.com.intentional.app'],
  },
});
