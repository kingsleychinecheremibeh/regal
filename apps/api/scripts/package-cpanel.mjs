// Package the compiled API for cPanel's "Setup Node.js App".
//
// Output: dist-cpanel/turboxglobal-api/
//   node_modules/   production dependencies as real folders (pnpm deploy,
//                   hoisted); kept outside the app root because cPanel's
//                   Node selector manages that
//   app/            the cPanel "Application root"; startup file dist/main.js
// plus dist-cpanel/turboxglobal-api.zip of the same folder.
//
// Run after `pnpm build`. argon2 ships a linux-x64 prebuild, so the package
// can be made on Windows.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const api = path.resolve(import.meta.dirname, "..");
const root = path.resolve(api, "..", "..");
const out = path.join(api, "dist-cpanel", "turboxglobal-api");
const staging = path.join(api, "dist-cpanel", "staging");
const zip = `${out}.zip`;

if (!fs.existsSync(path.join(api, "dist", "main.js")))
  throw new Error("Run `pnpm build` first.");

fs.rmSync(path.dirname(out), { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// 1. Production dependencies, with the workspace overrides applied.
execFileSync(
  process.execPath,
  [
    process.env.npm_execpath,
    "--filter",
    "@regalvest/api",
    "deploy",
    "--prod",
    "--legacy",
    "--config.node-linker=hoisted",
    staging,
  ],
  { cwd: root, stdio: "inherit" },
);
fs.renameSync(
  path.join(staging, "node_modules"),
  path.join(out, "node_modules"),
);
fs.rmSync(staging, { recursive: true, force: true });

// 2. The app itself. The package.json has no dependencies so that cPanel's
// "Run NPM Install" cannot replace the pinned ones.
const app = path.join(out, "app");
fs.cpSync(path.join(api, "dist"), path.join(app, "dist"), { recursive: true });
const pkg = JSON.parse(fs.readFileSync(path.join(api, "package.json"), "utf8"));
fs.writeFileSync(
  path.join(app, "package.json"),
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      private: true,
      main: "dist/main.js",
      scripts: { start: "node dist/main.js" },
    },
    null,
    2,
  ),
);

// 3. Zip it for upload through cPanel's File Manager. Windows' own tar writes
// forward-slash paths; Compress-Archive writes backslashes, which Linux
// extracts as literal file names.
if (process.platform === "win32")
  execFileSync(
    path.join(process.env.SystemRoot, "System32", "tar.exe"),
    ["-a", "-cf", zip, "app", "node_modules"],
    { cwd: out },
  );
else execFileSync("zip", ["-qr", zip, "."], { cwd: out });

console.log(`Upload ${path.relative(api, zip)}`);
