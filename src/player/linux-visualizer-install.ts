import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execa } from "execa";
import { paths } from "../config/paths";
import { downloadVerified } from "./linux-preset-packs";

const SOURCE_URL = "https://codeload.github.com/projectM-visualizer/projectm/tar.gz/refs/tags/v3.1.12";
const SOURCE_SHA = "62b5b1b543b25cb8ad392d879378cfdc5c129165cf4d4f33fb159e364d42f135";
const BUILD_REVISION = 1;
const root = path.join(paths.data, "projectM", "frontend");

async function systemBuild() {
  if (process.platform !== "linux") throw Error("The Linux fullscreen companion requires Linux.");
  const query = async (arg: string) => (await execa("pkg-config", [arg, "libprojectM"], { timeout: 5000 })).stdout.trim();
  const version = await query("--modversion");
  if (version !== "3.1.12") throw Error(`Fullscreen startup currently supports libprojectM 3.1.12; found ${version}.`);
  const include = await query("--variable=includedir"), lib = await query("--variable=libdir"), prefix = await query("--variable=prefix");
  for (const value of [include, lib, prefix]) if (!/^\/[\w/+.\-]+$/.test(value)) throw Error("Unsupported projectM development path.");
  const header = await fs.readFile(path.join(include, "libprojectM", "projectM.hpp"), "utf8");
  const signature = createHash("sha256").update(`${BUILD_REVISION}:${process.arch}:${version}:${header}`).digest("hex");
  return { version, include, lib, prefix, header, signature };
}

export async function linuxVisualizerExecutable(): Promise<string | null> {
  try {
    const system = await systemBuild();
    const dir = path.join(root, system.signature);
    const manifest = JSON.parse(await fs.readFile(path.join(dir, "manifest.json"), "utf8"));
    const executable = path.join(dir, "jukeboxcli-projectm");
    if (manifest.signature !== system.signature) return null;
    const check = await execa(executable, ["--jukeboxcli-self-test"], { timeout: 5000 });
    return check.stdout.trim() === "jukeboxcli-projectm-ready" ? executable : null;
  } catch { return null; }
}

export const FIRST_FRAME_PATCH = `if (!startupReady) {
                if (!m_projectM->getPlaylistSize()) return;
                for (int attempt = 0; attempt < 8 && !startupReady; ++attempt) {
                    m_projectM->selectRandom(true);
                    unsigned int index = 0;
                    startupReady = !m_projectM->getErrorLoadingCurrentPreset()
                        && m_projectM->selectedPresetIndex(index)
                        && index < m_projectM->getPlaylistSize();
                }
                if (!startupReady) {
                    fprintf(stderr, "JUKEBOXCLI_PROJECTM_ERROR: no playable startup preset\\n");
                    QApplication::exit(78);
                    return;
                }
                fprintf(stderr, "JUKEBOXCLI_PROJECTM_READY\\n");
                fflush(stderr);
            }
            m_projectM->renderFrame();`;

export function patchFirstFrame(source: string): string {
  if (source.split("m_projectM->renderFrame();").length !== 2 || !source.includes("int mouseHideTimeoutSeconds;")) {
    throw Error("Unexpected projectM frontend source; refusing to build an unpatched renderer.");
  }
  return source.replace("m_projectM->renderFrame();", FIRST_FRAME_PATCH)
    .replace("int mouseHideTimeoutSeconds;", "bool startupReady = false;\n        int mouseHideTimeoutSeconds;");
}

/** Build upstream's small Qt/PulseAudio frontend against the system shared core.
 * The one behaviour patch selects a real preset before the very first render.
 * Source, licences and the exact recipe stay beside the private executable.
 */
export async function installLinuxVisualizer(progress: (message: string) => void = () => {}) {
  if (await linuxVisualizerExecutable()) { progress("Linux fullscreen companion is ready."); return; }
  let system: Awaited<ReturnType<typeof systemBuild>>;
  try {
    system = await systemBuild();
    const qt = (await execa("qmake", ["-query", "QT_VERSION"])).stdout.trim();
    if (!qt.startsWith("5.")) throw Error("Qt 5 qmake is required.");
    await execa("make", ["--version"]);
    await execa("c++", ["--version"]);
  } catch (error) {
    throw Error(`Cannot build fullscreen companion. On Arch rerun ./install.sh, or install gcc make pkgconf qt5-base projectm-pulseaudio libpulse. ${error instanceof Error ? error.message : ""}`);
  }
  await fs.mkdir(root, { recursive: true });
  const stage = await fs.mkdtemp(path.join(root, ".build-"));
  try {
    progress("Downloading projectM frontend source (~53 MB, first setup only)…");
    const archive = path.join(stage, "source.tar.gz");
    await downloadVerified(SOURCE_URL, archive, SOURCE_SHA);
    const source = path.join(stage, "source"), build = path.join(stage, "build");
    await fs.mkdir(source); await fs.mkdir(build);
    await execa("tar", ["-xzf", archive, "--strip-components=1", "--no-same-owner", "-C", source], { timeout: 60_000 });
    await fs.rm(archive);
    const qtDir = path.join(source, "src/projectM-qt"), pulseDir = path.join(source, "src/projectM-pulseaudio");
    const widget = path.join(qtDir, "qprojectmwidget.hpp");
    await fs.writeFile(widget, patchFirstFrame(await fs.readFile(widget, "utf8")));
    const mainWindow = path.join(qtDir, "qprojectm_mainwindow.cpp");
    await fs.writeFile(mainWindow, (await fs.readFile(mainWindow, "utf8")).replaceAll("qInitResources()", "qInitResources_application()"));
    // Arch's shared core corrected the size_t callback; honour installed headers.
    if (system.header.includes("size_t /*index*/")) {
      const qprojectm = path.join(qtDir, "qprojectm.hpp");
      await fs.writeFile(qprojectm, (await fs.readFile(qprojectm, "utf8")).replace("void presetSwitchedEvent(bool hardCut, unsigned int index) const", "void presetSwitchedEvent(bool hardCut, size_t index) const override"));
    }
    const entry = path.join(pulseDir, "qprojectM-pulseaudio.cpp");
    const original = await fs.readFile(entry, "utf8");
    const main = /int main\s*\(\s*int argc, char\*argv\[\]\s*\)\s*\{/;
    if (!main.test(original)) throw Error("Unexpected frontend entry point.");
    await fs.writeFile(entry, original.replace(main, `$&\n    if (argc == 2 && std::string(argv[1]) == "--jukeboxcli-self-test") { puts("jukeboxcli-projectm-ready"); return 0; }`));
    const allFiles = (await Promise.all([qtDir, pulseDir].map(async dir => (await fs.readdir(dir)).map(name => path.relative(source, path.join(dir, name)))))).flat();
    const list = (extension: string) => allFiles.filter(f => f.endsWith(extension) && !f.endsWith("/ConfigFile.cpp")).join(" ");
    const recipe = `QT += widgets opengl xml
CONFIG += c++11 link_pkgconfig
PKGCONFIG += libpulse
TARGET = jukeboxcli-projectm
TEMPLATE = app
DEFINES += PROJECTM_PREFIX=\\\\\\"${system.prefix}\\\\\\"
INCLUDEPATH += . src/projectM-qt src/projectM-pulseaudio ${system.include}/libprojectM src/libprojectM src/libprojectM/Renderer
LIBS += -L${system.lib} -lprojectM -lGL
SOURCES += ${list(".cpp")}
HEADERS += ${list(".hpp")}
FORMS += ${list(".ui")}
RESOURCES += src/projectM-qt/application.qrc
`;
    await fs.writeFile(path.join(source, "jukeboxcli.pro"), recipe);
    progress("Building the fullscreen companion…");
    await execa("qmake", [path.join(source, "jukeboxcli.pro")], { cwd: build, timeout: 30_000 });
    try { await execa("make", ["-j2"], { cwd: build, timeout: 180_000, maxBuffer: 8 * 1024 * 1024 }); }
    catch (error) {
      // Do not flood the TUI with compiler output; retain it for diagnosis.
      await fs.writeFile(path.join(root, "last-build-error.txt"), String(error));
      throw Error(`Fullscreen build failed; details: ${path.join(root, "last-build-error.txt")}`);
    }
    const executable = path.join(stage, "jukeboxcli-projectm");
    await fs.rename(path.join(build, "jukeboxcli-projectm"), executable);
    const check = await execa(executable, ["--jukeboxcli-self-test"], { timeout: 5000 });
    if (check.stdout.trim() !== "jukeboxcli-projectm-ready") throw Error("Fullscreen companion startup check failed.");
    await fs.rm(build, { recursive: true });
    await fs.writeFile(path.join(stage, "manifest.json"), JSON.stringify({ signature: system.signature, source: SOURCE_URL, sha256: SOURCE_SHA, buildRevision: BUILD_REVISION, version: system.version, patch: "Select a valid preset before the first frame; retain source and GPL/LGPL notices." }, null, 2));
    const target = path.join(root, system.signature);
    // Keep a previous working build unless the new one has passed its check.
    const backup = `${target}.old-${process.pid}`;
    const exists = await fs.stat(target).catch(() => null);
    if (exists) await fs.rename(target, backup);
    try { await fs.rename(stage, target); }
    catch (error) { if (exists) await fs.rename(backup, target); throw error; }
    await fs.rm(backup, { recursive: true, force: true });
    progress("Linux fullscreen companion installed. The logo is never rendered at startup.");
  } finally { await fs.rm(stage, { recursive: true, force: true }); }
}
