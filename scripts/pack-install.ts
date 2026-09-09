// Bundle the locked production tree; npm12 excludes shrinkwrap from archives.
import { copyFile, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
const destination = process.argv[2];
if (!destination || !path.isAbsolute(destination)) throw Error("Absolute package staging directory required");
const root = path.resolve(import.meta.dirname, ".."), stage = path.join(destination, "package");
await mkdir(stage);
await cp(path.join(root, "dist"), path.join(stage, "dist"), { recursive: true });
for (const name of ["package.json", "README.md", "LICENSE"]) await copyFile(path.join(root, name), path.join(stage, name));
await copyFile(path.join(root, "package-lock.json"), path.join(stage, "package-lock.json"));
await execa("npm", ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: stage });
const manifest = JSON.parse(await readFile(path.join(stage, "package.json"), "utf8"));
manifest.bundleDependencies = Object.keys(manifest.dependencies);
await writeFile(path.join(stage, "package.json"), JSON.stringify(manifest, null, 2));
const result = await execa("npm", ["pack", "--ignore-scripts", "--pack-destination", destination, "--silent"], { cwd: stage });
console.log(result.stdout.trim());
