/**
 * US-096: ShieldAction extension (built by @bacons/apple-targets at prebuild).
 *
 * Handles the block screen's buttons. iOS doesn't let it open the app, so "Unlock with intention"
 * posts a notification; tapping it opens Intentional on the unlock screen (app/unlock.tsx).
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = () => ({
  type: 'shield-action',
  name: 'ShieldAction',
  bundleIdentifier: '.ShieldAction',
  deploymentTarget: '16.0',
  frameworks: ['ManagedSettings', 'UserNotifications'],
  entitlements: {
    'com.apple.developer.family-controls': true,
    'com.apple.security.application-groups': ['group.com.intentional.app'],
  },
});
