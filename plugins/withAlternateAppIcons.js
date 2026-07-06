const fs = require('fs');
const path = require('path');
const { withDangerousMod, withInfoPlist, withXcodeProject } = require('@expo/config-plugins');
const { generateImageAsync } = require('@expo/image-utils');

const alternateIcons = [
  { name: 'AppIcon2', source: 'assets/icon2.png' },
  { name: 'AppIcon3', source: 'assets/icon3.png' },
  { name: 'AppIcon4', source: 'assets/icon4.png' }
];
const bundledIconSizes = [
  { scale: '2x', size: 120 },
  { scale: '3x', size: 180 }
];

function findGroupKey(project, groupName) {
  const groups = project.hash.project.objects.PBXGroup;
  return Object.entries(groups).find(
    ([key, group]) => !key.endsWith('_comment') && group.name === groupName
  )?.[0];
}

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

async function createBundledIconFiles(projectRoot, iconName, sourcePath, iconsDirectory) {
  fs.mkdirSync(iconsDirectory, { recursive: true });
  for (const iconSize of bundledIconSizes) {
    const { source } = await generateImageAsync(
      { projectRoot, cacheType: `${iconName}-${iconSize.scale}-bundled-icon` },
      {
        name: `${iconName}-60@${iconSize.scale}.png`,
        src: sourcePath,
        width: iconSize.size,
        height: iconSize.size,
        resizeMode: 'cover',
        removeTransparency: true
      }
    );
    fs.writeFileSync(path.join(iconsDirectory, `${iconName}-60@${iconSize.scale}.png`), source);
  }
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
            CFBundleIconFiles: [`${icon.name}-60`],
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
      const bundledIconsDirectory = path.join(
        pluginConfig.modRequest.platformProjectRoot,
        projectName,
        'AlternateAppIcons'
      );

      for (const icon of alternateIcons) {
        const sourcePath = path.join(projectRoot, icon.source);
        await createAppIconSet(
          projectRoot,
          icon.name,
          sourcePath,
          path.join(assetsDirectory, `${icon.name}.appiconset`)
        );
        await createBundledIconFiles(projectRoot, icon.name, sourcePath, bundledIconsDirectory);
      }

      return pluginConfig;
    }
  ]);

  config = withXcodeProject(config, (pluginConfig) => {
    const projectName = pluginConfig.modRequest.projectName;
    const bundleIdentifier = pluginConfig.ios?.bundleIdentifier;
    const target = pluginConfig.modResults.getFirstTarget().uuid;
    const appGroupKey = findGroupKey(pluginConfig.modResults, projectName);
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
    for (const icon of alternateIcons) {
      for (const iconSize of bundledIconSizes) {
        const file = pluginConfig.modResults.addFile(
          `${projectName}/AlternateAppIcons/${icon.name}-60@${iconSize.scale}.png`,
          appGroupKey,
          { target }
        );
        if (!file) {
          continue;
        }
        file.uuid = pluginConfig.modResults.generateUuid();
        file.target = target;
        pluginConfig.modResults.addToPbxBuildFileSection(file);
        pluginConfig.modResults.addToPbxResourcesBuildPhase(file);
      }
    }
    return pluginConfig;
  });

  return config;
};
