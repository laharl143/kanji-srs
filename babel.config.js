// NativeWind (spec 0003) plus inlining drizzle/*.sql and content/*.txt as strings, so the
// migrations (spec 0002) and the content version (spec 0004) ship inside the bundle.
// `nativewind/babel` is a preset, not a plugin.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
    plugins: [["inline-import", { extensions: [".sql", ".txt"] }]],
  };
};
