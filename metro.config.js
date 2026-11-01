// Lets Metro bundle the SQL migration files in drizzle/ (spec 0002), then wraps the config with
// NativeWind so src/global.css becomes the design tokens (spec 0003). NativeWind stays outermost.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push("sql");

module.exports = withNativeWind(config, { input: "./src/global.css" });
