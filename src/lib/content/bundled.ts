// The content shipped inside the app: content/bundle.json plus content-version.txt, inlined at
// build time (babel `inline-import` for .txt, Metro `sourceExts`).
import bundle from "../../../content/bundle.json";
import version from "../../../content/content-version.txt";

import type { BundledContent, Bundle } from "./types";

export const bundledContent: BundledContent = {
  bundle: bundle as Bundle,
  version: version.trim(),
};
