const fs = require('fs');
const path = require('path');
const { withDangerousMod, withInfoPlist, withXcodeProject } = require('@expo/config-plugins');
const { generateImageAsync } = require('@expo/image-utils');

const alternateIcons = [
  { name: 'AppIcon2', source: 'assets/icon2.png' },
  { name: 'AppIcon3', source: 'assets/icon3.png' },
  { name: 'AppIcon4', source: 'assets/icon4.png' }
];

async function createAppIconSet(projectRoot, iconName, sourcePath, iconSetDirectory) {
  fs.mkdirSync(iconSetDirectory, { recursive: true });
  const { source } = await generateImageAsync(
    { projectRoot, cacheType: `${iconName}-alternate-icon` },
    {
      name: `${iconName}.png`,
      src: sourcePath,
      width: 1024,
      height: 1024,
      resizeMode: 'cover',
      removeTransparency: true
    }
  );
  fs.writeFileSync(path.join(iconSetDirectory, `${iconName}.png`), source);
  fs.writeFileSync(
    path.join(iconSetDirectory, 'Contents.json'),
    `${JSON.stringify(
      {
        images: [
          {
            filename: `${iconName}.png`,
            idiom: 'universal',
            platform: 'ios',
            size: '1024x1024'
          }
        ],
        info: {
          version: 1,
          author: 'expo'
        }
      },
      null,
      2
    )}\n`
  );
}

module.exports = function withAlternateAppIcons(config) {
  config = withInfoPlist(config, (pluginConfig) => {
    pluginConfig.modResults.CFBundleIcons = {
      CFBundlePrimaryIcon: {
        CFBundleIconFiles: ['AppIcon'],
        UIPrerenderedIcon: false
      },
      CFBundleAlternateIcons: Object.fromEntries(
        alternateIcons.map((icon) => [
          icon.name,
          {
            CFBundleIconFiles: [icon.name],
            UIPrerenderedIcon: false
          }
        ])
      )
    };
    return pluginConfig;
  });

  config = withDangerousMod(config, [
    'ios',
    async (pluginConfig) => {
      const projectRoot = pluginConfig.modRequest.projectRoot;
      const projectName = pluginConfig.modRequest.projectName;
      const assetsDirectory = path.join(
        pluginConfig.modRequest.platformProjectRoot,
        projectName,
        'Images.xcassets'
      );

      for (const icon of alternateIcons) {
        await createAppIconSet(
          projectRoot,
          icon.name,
          path.join(projectRoot, icon.source),
          path.join(assetsDirectory, `${icon.name}.appiconset`)
        );
      }

      return pluginConfig;
    }
  ]);

  config = withXcodeProject(config, (pluginConfig) => {
    const bundleIdentifier = pluginConfig.ios?.bundleIdentifier;
    const buildConfigurations = pluginConfig.modResults.pbxXCBuildConfigurationSection();
    for (const buildConfiguration of Object.values(buildConfigurations)) {
      const buildSettings = buildConfiguration.buildSettings;
      if (!buildSettings || buildSettings.PRODUCT_BUNDLE_IDENTIFIER !== bundleIdentifier) {
        continue;
      }
      buildSettings.ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES = `"${alternateIcons
        .map((icon) => icon.name)
        .join(' ')}"`;
      buildSettings.ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = 'YES';
    }
    return pluginConfig;
  });

  return config;
};
