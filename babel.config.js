module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    // react-native-worklets/plugin MUST be the LAST plugin. Required by
    // Reanimated 4 (replaces the older 'react-native-reanimated/plugin').
    plugins: ['react-native-worklets/plugin'],
  };
};
