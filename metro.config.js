// Lets Metro bundle the SQL migration files in drizzle/ (spec 0002).
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push("sql");

module.exports = config;
