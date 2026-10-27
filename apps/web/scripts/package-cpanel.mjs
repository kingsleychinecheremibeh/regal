// Package the standalone Next.js build for cPanel's "Setup Node.js App".
//
// Output: dist/cpanel/turboxglobal-web/
//   node_modules/   flattened real folders (no pnpm symlinks); kept outside
//                   the app root because cPanel's Node selector manages that
//   app/            the cPanel "Application root"; startup file server.js
// plus dist/cpanel/turboxglobal-web.zip of the same folder.
//
// Run after `next build` with API_PROXY_TARGET set (rewrites are fixed at build).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const web = path.resolve(import.meta.dirname, "..");
const standalone = path.join(web, ".next", "standalone");
const out = path.join(web, "dist", "cpanel", "turboxglobal-web");
const zip = `${out}.zip`;

if (!fs.existsSync(path.join(standalone, "apps", "web", "server.js")))
  throw new Error("Run `next build` first (output: standalone).");

fs.rmSync(path.dirname(out), { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// 1. The app itself, without the symlinked node_modules folder.
const app = path.join(out, "app");
fs.cpSync(path.join(standalone, "apps", "web"), app, {
  recursive: true,
  filter: (source) =>
    !source.startsWith(path.join(standalone, "apps", "web", "node_modules")),
});
fs.cpSync(
  path.join(web, ".next", "static"),
  path.join(app, ".next", "static"),
  {
    recursive: true,
  },
);
if (fs.existsSync(path.join(web, "public")))
  fs.cpSync(path.join(web, "public"), path.join(app, "public"), {
    recursive: true,
  });
for (const file of fs.readdirSync(app))
  if (file.startsWith(".env")) fs.rmSync(path.join(app, file));

// 2. Flatten every package in the pnpm store into one node_modules folder.
const store = path.join(standalone, "node_modules", ".pnpm");
const modules = path.join(out, "node_modules");
const seen = new Map();
// Image optimisation is off, so sharp and its native, platform-specific
// binaries are not needed on the server.
const skip = (name) =>
  ["sharp", "detect-libc", "semver"].includes(name) || name.startsWith("@img/");
const copy = (name, source) => {
  if (skip(name)) return;
  const real = fs.realpathSync(source);
  const version = JSON.parse(
    fs.readFileSync(path.join(real, "package.json"), "utf8"),
  ).version;
  if (seen.has(name)) {
    if (seen.get(name) !== version)
      console.warn(`! ${name}: keeping ${seen.get(name)}, skipping ${version}`);
    return;
  }
  seen.set(name, version);
  fs.cpSync(real, path.join(modules, name), {
    recursive: true,
    dereference: true,
  });
};
for (const entry of fs.readdirSync(store)) {
  const dir = path.join(store, entry, "node_modules");
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir)) {
    if (name === ".bin") continue;
    if (name.startsWith("@"))
      for (const scoped of fs.readdirSync(path.join(dir, name)))
        copy(`${name}/${scoped}`, path.join(dir, name, scoped));
    else copy(name, path.join(dir, name));
  }
}

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

console.log(`Packaged ${seen.size} packages into ${path.relative(web, out)}`);
console.log(`Upload ${path.relative(web, zip)}`);
