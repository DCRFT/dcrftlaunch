type Download = {
    sha1: string;
    size: string;
    url: string;
};
type Runtimes = {
    [index: string]: {
        [index: string]: [{
            manifest: {
                url: string;
            };
        }];
    };
};
type RuntimeManifest = {
    files: {
        [index: string]: {
            type: "directory" | "file" | "link";
            executable?: boolean;
            target?: string;
            downloads: {
                lzma: Download;
                raw: Download;
            };
        };
    };
};
type VersionManifest = {
    javaVersion: {
        component: string;
        majorVersion: number;
    };
};
type VersionsManifest = {
    latest: {
        release: string;
        snapshot: string;
    };
    versions: {
        id: string;
        url: string;
    }[];
};

/**
 * Returns the component associated with the input minecraft version. Needed for any function other that .use
 */
declare function getComponent(mcVersion: string): Promise<string>;

/**
 * Initialize a java manager instance, taking as input the path to the folder storing the runtimes. In the following documentation, a "store" refers to the folder where runtimes are stored.
 */
declare class JavaManager {
    path: string;
    private runtimes?;
    private progressCallback?;
    constructor(path: string);
    private checkForStore;
    private getRuntimes;
    /**
     * Install a runtume by component.
     */
    install(component: string): Promise<void>;
    /**
     * Delete a runtime by component.
     */
    uninstall(component: string): Promise<void>;
    /**
     * Returns an array of component strings, essentially fs.readdir on the store path.
     */
    list(): Promise<string[]>;
    /**
     * Calls .install with the corresponding Minecraft version and returns the path to the executable. On Windows, you can define the executable as javaw to hide the console.
     */
    use(mcVersion: string, executable?: string): Promise<string>;
    /**
     * Define the callback function called each time a file is downloaded.
     */
    onProgress(cb: (progress: number, total: number) => void): void;
    /**
     * Compares runtime files with mojang api checksums; if a file doesn't match, it's downloaded again.
     */
    checkIntegrity(component: string): Promise<void>;
}

export { type Download, JavaManager, type RuntimeManifest, type Runtimes, type VersionManifest, type VersionsManifest, getComponent };
