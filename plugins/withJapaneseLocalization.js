const { withInfoPlist, withXcodeProject } = require('@expo/config-plugins');

function setJapaneseInfoPlist(infoPlist) {
  infoPlist.CFBundleDevelopmentRegion = 'ja';
  infoPlist.CFBundleLocalizations = ['ja'];
  return infoPlist;
}

module.exports = function withJapaneseLocalization(config) {
  config = withInfoPlist(config, (pluginConfig) => {
    setJapaneseInfoPlist(pluginConfig.modResults);
    return pluginConfig;
  });

  config = withXcodeProject(config, (pluginConfig) => {
    const projects = pluginConfig.modResults.hash.project.objects.PBXProject;
    for (const project of Object.values(projects)) {
      if (!project || typeof project !== 'object' || project.isa !== 'PBXProject') {
        continue;
      }
      project.developmentRegion = 'ja';
      project.knownRegions = ['ja', 'Base'];
    }
    return pluginConfig;
  });

  return config;
};
