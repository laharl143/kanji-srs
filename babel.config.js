// Inlines drizzle/*.sql as strings so the migrations ship inside the bundle (spec 0002).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [["inline-import", { extensions: [".sql"] }]],
  };
};
