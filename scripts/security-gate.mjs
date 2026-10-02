import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const self = "scripts/security-gate.mjs";
const failures = [];

function normalize(file) {
  return file.replaceAll("\\", "/");
}

function fallbackFiles(directory = root, prefix = "") {
  const ignored = new Set([".git", "node_modules", ".next", ".vinext", "dist", "data", "backups", ".sites-runtime"]);
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    const relative = normalize(path.join(prefix, entry.name));
    if (entry.isDirectory()) files.push(...fallbackFiles(absolute, relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

function trackedFiles() {
  const result = spawnSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status === 0) {
    return result.stdout.split("\0").filter(Boolean).map(normalize);
  }
  return fallbackFiles();
}

function lineFor(content, index) {
  return content.slice(0, index).split("\n").length;
}

function record(file, message, index, content) {
  const where = Number.isInteger(index) ? `:${lineFor(content, index)}` : "";
  failures.push(`${file}${where} — ${message}`);
}

const files = trackedFiles();

const sensitiveBasenames = [
  /^id_(?:rsa|dsa|ecdsa|ed25519)$/i,
  /^credentials(?:\.[^.]+)?$/i,
  /^secrets?(?:\.[^.]+)?$/i,
  /^service-account(?:\.[^.]+)?\.json$/i,
];

for (const file of files) {
  const base = path.basename(file);
  const envFile =
    /^\.env(?:\.|$)/i.test(base) &&
    !/^\.env\.(?:example|sample|template)$/i.test(base);

  if (envFile || sensitiveBasenames.some((pattern) => pattern.test(base))) {
    record(file, "sensitive file name must not be committed");
  }
}

for (const required of ["pnpm-lock.yaml", "pnpm-workspace.yaml", ".gitignore"]) {
  if (!files.includes(required)) record(required, "required supply-chain control file is missing");
}

if (existsSync(path.join(root, "pnpm-workspace.yaml"))) {
  const policy = readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8");
  if (!/strictDepBuilds:\s*true\b/.test(policy)) {
    record("pnpm-workspace.yaml", "strictDepBuilds must stay enabled");
  }
  const age = policy.match(/minimumReleaseAge:\s*(\d+)/);
  if (!age || Number(age[1]) < 10080) {
    record("pnpm-workspace.yaml", "minimumReleaseAge must remain at least 10080 minutes (7 days)");
  }
  if (!/trustLockfile:\s*false\b/.test(policy)) {
    record("pnpm-workspace.yaml", "trustLockfile must stay false so package integrity is re-verified");
  }

  const policyLines = policy.split("\n");
  const ageExcludes = [];
  let readingAgeExcludes = false;
  for (const line of policyLines) {
    if (/^minimumReleaseAgeExclude:\s*$/.test(line)) {
      readingAgeExcludes = true;
      continue;
    }
    if (readingAgeExcludes && /^\S/.test(line)) break;
    if (readingAgeExcludes) {
      const match = line.match(/^\s*-\s*(\S+)\s*$/);
      if (match) ageExcludes.push(match[1]);
    }
  }
  const allowedAgeExcludes = new Set(["image-size@2.0.3", "next@16.3.6", "eslint-config-next@16.3.6", "undici@7.29.1", "brace-expansion@1.1.20", "brace-expansion@5.0.11"]);
  for (const excluded of ageExcludes) {
    if (!allowedAgeExcludes.has(excluded)) {
      record("pnpm-workspace.yaml", `unapproved minimum-release-age exception: ${excluded}`);
    }
  }
  if (/image-size:\s*2\.0\.3\b/.test(policy) && !ageExcludes.includes("image-size@2.0.3")) {
    record("pnpm-workspace.yaml", "image-size 2.0.3 security hotfix must use the exact approved release-age exception");
  }
}

if (existsSync(path.join(root, ".gitignore"))) {
  const ignore = readFileSync(path.join(root, ".gitignore"), "utf8");
  for (const required of [".env*", "/data/", "/backups/"]) {
    if (!ignore.includes(required)) {
      record(".gitignore", `must ignore ${required}`);
    }
  }
}

const textExtensions = new Set([
  ".cjs", ".css", ".html", ".ini", ".js", ".json", ".jsx", ".md", ".mjs",
  ".mts", ".ps1", ".sh", ".ts", ".tsx", ".txt", ".yaml", ".yml",
]);
const firstPartyPrefixes = ["app/", "db/", "lib/", "scripts/"];

const secretPatterns = [
  ["private key material", /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/g],
  ["GitHub token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/g],
  ["GitHub fine-grained token", /\bgithub_pat_[A-Za-z0-9_]{50,}\b/g],
  ["OpenAI-style secret", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g],
  ["npm token", /\bnpm_[A-Za-z0-9]{30,}\b/g],
  ["npm auth token assignment", /_authToken\s*=\s*(?!\$\{)[^\s#]+/g],
];

const dangerousPatterns = [
  ["dynamic eval", /\beval\s*\(/g],
  ["dynamic Function constructor", /\bnew\s+Function\s*\(/g],
  ["child_process exec import", /import\s*\{[^}]*\bexec(?:Sync)?\b[^}]*\}\s*from\s*["']node:child_process["']/g],
  ["child_process exec require", /require\s*\(\s*["']node:child_process["']\s*\)\.exec(?:Sync)?\s*\(/g],
  ["TLS certificate verification disabled", /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0/g],
  ["TLS verification bypass", /rejectUnauthorized\s*:\s*false/g],
];

for (const file of files) {
  if (file === self) continue;
  const ext = path.extname(file).toLowerCase();
  if (!textExtensions.has(ext)) continue;

  const absolute = path.join(root, file);
  let content;
  try {
    content = readFileSync(absolute, "utf8");
  } catch {
    continue;
  }
  if (content.includes("\0")) continue;

  for (const [label, pattern] of secretPatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(content);
    if (match) record(file, label, match.index, content);
  }

  if (firstPartyPrefixes.some((prefix) => file.startsWith(prefix))) {
    for (const [label, pattern] of dangerousPatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(content);
      if (match) record(file, label, match.index, content);
    }
  }
}

for (const file of files.filter((name) => /^\.github\/workflows\/.*\.ya?ml$/i.test(name))) {
  const content = readFileSync(path.join(root, file), "utf8");

  if (/\bpull_request_target\s*:/m.test(content)) {
    record(file, "pull_request_target is forbidden by repository policy");
  }
  if (/permissions\s*:\s*write-all/m.test(content)) {
    record(file, "write-all workflow permissions are forbidden");
  }
  if (/persist-credentials\s*:\s*true/m.test(content)) {
    record(file, "checkout credentials must not persist after checkout");
  }

  const usesPattern = /^\s*-?\s*uses:\s*([^\s#]+)/gm;
  let match;
  while ((match = usesPattern.exec(content))) {
    const action = match[1];
    if (action.startsWith("./")) continue;
    const at = action.lastIndexOf("@");
    const ref = at === -1 ? "" : action.slice(at + 1);
    if (!/^[0-9a-f]{40}$/i.test(ref)) {
      record(file, `action must be pinned to a full 40-character commit SHA: ${action}`, match.index, content);
    }
  }
}

if (failures.length) {
  console.error("\nMemeSpace security gate FAILED:\n");
  for (const failure of failures) console.error(` - ${failure}`);
  console.error(`\n${failures.length} security policy violation(s) found.\n`);
  process.exit(1);
}

console.log(`MemeSpace security gate passed: ${files.length} tracked files checked.`);
