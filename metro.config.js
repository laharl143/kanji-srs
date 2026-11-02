// Lets Metro bundle the SQL migrations in drizzle/ (spec 0002) and content/content-version.txt
// (spec 0004), then wraps the config with NativeWind so src/global.css becomes the design tokens
// (spec 0003). NativeWind stays outermost.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push("sql", "txt");

module.exports = withNativeWind(config, { input: "./src/global.css" });
