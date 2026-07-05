const appJson = require('./app.json');

module.exports = () => {
  const config = appJson.expo;
  return {
    ...config,
    ios: {
      ...config.ios,
      appleTeamId: process.env.APPLE_TEAM_ID || config.ios.appleTeamId
    }
  };
};
