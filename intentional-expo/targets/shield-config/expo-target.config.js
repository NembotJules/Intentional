/**
 * US-096: ShieldConfiguration extension (built by @bacons/apple-targets at prebuild).
 *
 * iOS draws the screen shown when a blocked app is opened; this extension only gives it our words
 * and colours: "Is this intentional?", "Keep it blocked" and "Unlock with intention".
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = () => ({
  type: 'shield-config',
  name: 'ShieldConfiguration',
  bundleIdentifier: '.ShieldConfiguration',
  deploymentTarget: '16.0',
  frameworks: ['ManagedSettings', 'ManagedSettingsUI', 'UIKit'],
  entitlements: {
    'com.apple.developer.family-controls': true,
    'com.apple.security.application-groups': ['group.com.intentional.app'],
  },
});
