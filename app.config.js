module.exports = () => {
  return {
    name: '勝率カウンター',
    slug: 'win-track',
    version: '1.0.0',
    icon: './assets/icon1.png',
    platforms: ['ios'],
    orientation: 'portrait',
    scheme: 'wintrack',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.sknkaaa.wintrack',
      appleTeamId: process.env.APPLE_TEAM_ID,
      entitlements: {
        'com.apple.security.application-groups': ['group.com.sknkaaa.wintrack']
      },
      infoPlist: {
        NSCameraUsageDescription: 'カウンター写真を撮影するためにカメラを使用します。',
        NSPhotoLibraryUsageDescription: 'カウンター写真を選択するために写真ライブラリを使用します。'
      }
    },
    plugins: [
      [
        'expo-image-picker',
        {
          photosPermission: 'カウンター写真を選択するために写真ライブラリを使用します。',
          cameraPermission: 'カウンター写真を撮影するためにカメラを使用します。'
        }
      ],
      'expo-font',
      './plugins/withAlternateAppIcons',
      '@bacons/apple-targets'
    ]
  };
};
