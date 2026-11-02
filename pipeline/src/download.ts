// npm run pipeline:download [-- --force]
// Fetches every pinned source into pipeline/raw/ and records it in SOURCES.json (spec 0004 AC-1).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { EnvHttpProxyAgent, fetch } from "undici";

import { RAW_DIR, SOURCES, TANOS_LICENSE_TEXT, tanosLicense, type Source } from "./sources";

type SourceRecord = {
  file: string;
  url: string;
  origin?: string;
  downloadedAt: string;
  sha256: string;
  license: string;
};

type SourcesFile = {
  tanosLicense: typeof tanosLicense;
  tanosLicenseText: string;
  files: SourceRecord[];
};

const SOURCES_JSON = join(RAW_DIR, "SOURCES.json");

// The file the parsers read: a .tgz unpacks to its name without the suffix.
function targetName(source: Source): string {
  return source.unpack === "tgz" ? source.file.replace(/\.tgz$/, "") : source.file;
}

// A jmdict-simplified .tgz holds one JSON file. Reads the tar headers directly (512 byte blocks).
export function untarSingleJson(tgz: Buffer): Buffer {
  const tar = gunzipSync(tgz);
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/s, "");
    if (!name) break;
    const size = parseInt(header.subarray(124, 136).toString("utf8").replace(/\0.*$/s, ""), 8);
    const type = String.fromCharCode(header[156] || 48);
    const start = offset + 512;
    if ((type === "0" || type === "\0") && name.endsWith(".json")) {
      return tar.subarray(start, start + size);
    }
    offset = start + Math.ceil(size / 512) * 512;
  }
  throw new Error("no .json file inside the archive");
}

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function readSourcesFile(): SourcesFile | undefined {
  if (!existsSync(SOURCES_JSON)) return undefined;
  return JSON.parse(readFileSync(SOURCES_JSON, "utf8")) as SourcesFile;
}

async function fetchSource(source: Source, agent: EnvHttpProxyAgent): Promise<Buffer> {
  const res = await fetch(source.url, { dispatcher: agent, redirect: "follow" });
  if (!res.ok) {
    // jmdict-simplified renames assets between releases; say so plainly (spec 0004 Consequences).
    throw new Error(
      `${source.file}: HTTP ${res.status} from ${source.url}. If the release asset was renamed or ` +
        `removed, update the pin in pipeline/src/sources.ts.`,
    );
  }
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const force = process.argv.includes("--force");
  mkdirSync(RAW_DIR, { recursive: true });
  // Honors HTTPS_PROXY / HTTP_PROXY / NO_PROXY, so it works behind the corporate proxy.
  const agent = new EnvHttpProxyAgent();
  const previous = new Map((readSourcesFile()?.files ?? []).map((r) => [r.file, r]));
  const records: SourceRecord[] = [];

  for (const source of SOURCES) {
    const target = join(RAW_DIR, targetName(source));
    const known = previous.get(source.file);
    if (!force && existsSync(target)) {
      console.log(`skip  ${source.file} (present; --force to fetch again)`);
      records.push(
        known && known.url === source.url
          ? known
          : {
              file: source.file,
              url: source.url,
              origin: source.origin,
              downloadedAt: statSync(target).mtime.toISOString(),
              sha256: source.unpack ? "unknown (placed by hand)" : sha256(readFileSync(target)),
              license: source.license,
            },
      );
      continue;
    }
    console.log(`fetch ${source.file}`);
    const data = await fetchSource(source, agent);
    writeFileSync(target, source.unpack === "tgz" ? untarSingleJson(data) : data);
    records.push({
      file: source.file,
      url: source.url,
      origin: source.origin,
      downloadedAt: new Date().toISOString(),
      sha256: sha256(data),
      license: source.license,
    });
  }

  const out: SourcesFile = { tanosLicense, tanosLicenseText: TANOS_LICENSE_TEXT, files: records };
  writeFileSync(SOURCES_JSON, JSON.stringify(out, null, 2) + "\n");
  console.log(`wrote ${SOURCES_JSON} (${records.length} files)`);
}

if (process.argv[1]?.endsWith("download.ts")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
