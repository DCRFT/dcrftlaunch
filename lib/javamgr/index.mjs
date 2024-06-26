// src/index.ts
import fs2 from "fs/promises";
import { join } from "path";

// src/utils.ts
import fs from "fs/promises";
import { createWriteStream } from "fs";
import { Writable } from "stream";
async function fs_exists(path) {
  try {
    await fs.stat(path);
    return true;
  } catch {
    return false;
  }
}
async function getJSON(url) {
  return await (await fetch(url)).json();
}
async function download(url, destination) {
  const response = await fetch(url);
  const stream = Writable.toWeb(createWriteStream(destination));
  if (response.ok && response.body) {
    await response.body.pipeTo(stream);
  } else
    throw new Error(`Couldn't download (HTTP CODE ${response.status}): ${url}`);
}
function getOS() {
  switch (process.platform) {
    case "linux": {
      switch (process.arch) {
        case "ia32":
          return "linux-i386";
        case "x64":
          return "linux";
        default:
          throw new Error("Unsupported arch");
      }
    }
    case "win32": {
      switch (process.arch) {
        case "arm64":
          return "windows-arm64";
        case "ia32":
          return "windows-x86";
        case "x64":
          return "windows-x64";
        default:
          throw new Error("Unsupported arch");
      }
    }
    case "darwin": {
      switch (process.arch) {
        case "arm64":
          return "macos-arm64";
        case "x64":
          return "macos";
        default:
          throw new Error("Unsupported arch");
      }
    }
    default:
      throw new Error("Unsupported operating system");
  }
}
async function getComponent(mcVersion) {
  const versions = (await getJSON(
    "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json"
  )).versions;
  const versionManifestURL = versions.find(
    (version) => version.id === mcVersion
  )?.url;
  if (!versionManifestURL) throw new Error(`${mcVersion} doesn't exist.`);
  const versionManifest = await getJSON(versionManifestURL);
  let component = versionManifest.javaVersion?.component;
  if (!component) {
    console.warn(
      "Versions near 1.6.3 miss java informations, assuming java 8 is needed. This can be ignored."
    );
    component = "jre-legacy";
  }
  return component;
}

// src/index.ts
import { createHash } from "node:crypto";
var defaultExecutable = process.platform === "win32" ? "java.exe" : "java";
var JavaManager = class {
  path;
  runtimes;
  progressCallback;
  constructor(path) {
    this.path = path;
  }
  async checkForStore() {
    if (!await fs_exists(this.path)) {
      throw new Error("Store folder doesn't exist : " + this.path);
    }
  }
  async getRuntimes() {
    if (!this.runtimes) {
      this.runtimes = await getJSON(
        "https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json"
      );
    }
    return this.runtimes;
  }
  /**
   * Install a runtume by component.
   */
  async install(component) {
    await this.checkForStore();
    const destination = join(this.path, component);
    if (await fs_exists(destination)) {
      return;
    } else await fs2.mkdir(destination);
    const runtime = await getJSON(
      (await this.getRuntimes())[getOS()][component][0].manifest.url
    );
    let progress = 0;
    const total = Object.keys(runtime.files).length;
    if (this.progressCallback) this.progressCallback(progress, total);
    for (const key in runtime.files) {
      if (Object.prototype.hasOwnProperty.call(runtime.files, key)) {
        const file = runtime.files[key];
        const fileDestination = join(destination, key);
        switch (file.type) {
          case "directory":
            await fs2.mkdir(fileDestination);
            break;
          case "file":
            await download(file.downloads.raw.url, fileDestination);
            break;
          case "link":
            await fs2.writeFile(fileDestination, `Please see ${file.target}`);
            break;
        }
        progress++;
        if (this.progressCallback) this.progressCallback(progress, total);
      }
    }
  }
  /**
   * Delete a runtime by component.
   */
  async uninstall(component) {
    await this.checkForStore();
    const target = join(this.path, component);
    if (await fs_exists(target)) {
      await fs2.rm(target, { recursive: true });
    }
  }
  /**
   * Returns an array of component strings, essentially fs.readdir on the store path.
   */
  async list() {
    return await fs2.readdir(this.path);
  }
  /**
   * Calls .install with the corresponding Minecraft version and returns the path to the executable. On Windows, you can define the executable as javaw to hide the console.
   */
  async use(mcVersion, executable = "java") {
    await this.checkForStore();
    const component = await getComponent(mcVersion);
    const destination = join(this.path, component);
    if (await fs_exists(destination)) {
      return join(destination, "bin", executable);
    }
    await this.install(component);
    return join(destination, "bin", executable || defaultExecutable);
  }
  /**
   * Define the callback function called each time a file is downloaded.
   */
  onProgress(cb) {
    this.progressCallback = cb;
  }
  /**
   * Compares runtime files with mojang api checksums; if a file doesn't match, it's downloaded again.
   */
  async checkIntegrity(component) {
    await this.checkForStore();
    const target = join(this.path, component);
    if (!await fs_exists(target)) {
      return;
    }
    const runtime = await getJSON(
      (await this.getRuntimes())[getOS()][component][0].manifest.url
    );
    let progress = 0;
    const total = Object.keys(runtime.files).length;
    if (this.progressCallback) this.progressCallback(progress, total);
    for (const key in runtime.files) {
      if (Object.prototype.hasOwnProperty.call(runtime.files, key)) {
        const file = runtime.files[key];
        const fileTarget = join(target, key);
        if (!await fs_exists(fileTarget)) {
          await download(file.downloads.raw.url, fileTarget);
        } else {
          if (file.type === "file") {
            const hash = createHash("sha1").update(await fs2.readFile(fileTarget)).digest("hex");
            if (hash !== file.downloads.raw.sha1) {
              console.log(fileTarget);
              await download(file.downloads.raw.url, fileTarget);
            }
          }
        }
        progress++;
        if (this.progressCallback) this.progressCallback(progress, total);
      }
    }
    await fs2.chmod(join(target, "bin", "java"), 511);
  }
};
export {
  JavaManager,
  getComponent
};
