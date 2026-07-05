/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'WinRateWidget',
  bundleIdentifier: 'com.sknkaaa.wintrack.widgets',
  deploymentTarget: '17.0',
  frameworks: ['WidgetKit', 'SwiftUI', 'AppIntents'],
  entitlements: {
    'com.apple.security.application-groups':
      config.ios?.entitlements?.['com.apple.security.application-groups'] ?? [
        'group.com.sknkaaa.wintrack'
      ]
  }
});
