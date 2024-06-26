"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  JavaManager: () => JavaManager,
  getComponent: () => getComponent
});
module.exports = __toCommonJS(src_exports);
var import_promises2 = __toESM(require("fs/promises"));
var import_path = require("path");

// src/utils.ts
var import_promises = __toESM(require("fs/promises"));
var import_fs = require("fs");
var import_stream = require("stream");
async function fs_exists(path) {
  try {
    await import_promises.default.stat(path);
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
  const writableStream = (0, import_fs.createWriteStream)(destination);
  if (response.ok && response.body) {
    const writable = new WritableStream({
      write(chunk) {
        writableStream.write(chunk);
      },
      close() {
        writableStream.end();
      },
      abort(err) {
        writableStream.destroy(err);
      }
    });
    await response.body.pipeTo(writable);
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
var import_node_crypto = require("crypto");
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
    const destination = (0, import_path.join)(this.path, component);
    if (await fs_exists(destination)) {
      return;
    } else await import_promises2.default.mkdir(destination);
    const runtime = await getJSON(
      (await this.getRuntimes())[getOS()][component][0].manifest.url
    );
    let progress = 0;
    const total = Object.keys(runtime.files).length;
    if (this.progressCallback) this.progressCallback(progress, total);
    for (const key in runtime.files) {
      if (Object.prototype.hasOwnProperty.call(runtime.files, key)) {
        const file = runtime.files[key];
        const fileDestination = (0, import_path.join)(destination, key);
        switch (file.type) {
          case "directory":
            await import_promises2.default.mkdir(fileDestination);
            break;
          case "file":
            await download(file.downloads.raw.url, fileDestination);
            break;
          case "link":
            await import_promises2.default.writeFile(fileDestination, `Please see ${file.target}`);
            break;
        }
        progress++;
        if (this.progressCallback) this.progressCallback(progress, total);
      }
    }
    if (process.platform !== "win32") {
      fs.chmodSync(path.join(destination, "bin", "java"), 0o777);
    }
  }
  /**
   * Delete a runtime by component.
   */
  async uninstall(component) {
    await this.checkForStore();
    const target = (0, import_path.join)(this.path, component);
    if (await fs_exists(target)) {
      await import_promises2.default.rm(target, { recursive: true });
    }
  }
  /**
   * Returns an array of component strings, essentially fs.readdir on the store path.
   */
  async list() {
    return await import_promises2.default.readdir(this.path);
  }
  /**
   * Calls .install with the corresponding Minecraft version and returns the path to the executable. On Windows, you can define the executable as javaw to hide the console.
   */
  async use(mcVersion, executable = "java") {
    await this.checkForStore();
    const component = await getComponent(mcVersion);
    const destination = (0, import_path.join)(this.path, component);
    if (await fs_exists(destination)) {
      return (0, import_path.join)(destination, "bin", executable);
    }
    await this.install(component);
    return (0, import_path.join)(destination, "bin", executable || defaultExecutable);
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
    const target = (0, import_path.join)(this.path, component);
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
        const fileTarget = (0, import_path.join)(target, key);
        if (!await fs_exists(fileTarget)) {
          await download(file.downloads.raw.url, fileTarget);
        } else {
          if (file.type === "file") {
            const hash = (0, import_node_crypto.createHash)("sha1").update(await import_promises2.default.readFile(fileTarget)).digest("hex");
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
    await import_promises2.default.chmod((0, import_path.join)(target, "bin", "java"), 511);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  JavaManager,
  getComponent
});
