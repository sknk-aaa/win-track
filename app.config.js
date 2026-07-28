module.exports = () => {
  const cameraPermission =
    'カウンターに表示する写真を撮影するためにカメラを使用します。例えば、デッキやチームを識別する画像をその場で撮影して登録できます。';
  const photosPermission =
    'カウンターに表示する写真を選択するために写真ライブラリを使用します。例えば、デッキやチームを識別する画像を選んで登録できます。';

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
        CFBundleDevelopmentRegion: 'ja',
        CFBundleLocalizations: ['ja'],
        NSCameraUsageDescription: cameraPermission,
        NSPhotoLibraryUsageDescription: photosPermission
      }
    },
    plugins: [
      [
        'expo-image-picker',
        {
          photosPermission,
          cameraPermission,
          microphonePermission: false
        }
      ],
      'expo-font',
      './plugins/withAlternateAppIcons',
      '@bacons/apple-targets',
      './plugins/withJapaneseLocalization'
    ]
  };
};
