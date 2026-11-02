// NativeWind (spec 0003) plus inlining drizzle/*.sql as strings so the migrations ship inside
// the bundle (spec 0002). `nativewind/babel` is a preset, not a plugin.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
    plugins: [["inline-import", { extensions: [".sql"] }]],
  };
};
