import { defineConfig, globalIgnores } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  expoConfig,
  prettier,
  globalIgnores([
    ".expo/**",
    "dist/**",
    "android/**",
    "ios/**",
    "expo-env.d.ts",
    ".claude/**",
    ".agents/**",
    ".bob/**",
  ]),
]);
