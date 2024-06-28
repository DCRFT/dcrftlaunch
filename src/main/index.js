const {ipcRenderer, shell} = require('electron');
const $ = require("jquery");
const utils = require('../utils.js');
const os = require('os');
const path = require('node:path')
const fs = require("node:fs");
const {debug, setRPC, loadRPC} = require("../utils");
const nconf = require("nconf")
const {JavaManager} = require("../../lib/javamgr/index.js");

const {Client, Authenticator} = require('minecraft-launcher-core');
const launcher = new Client();
const {Auth} = require("msmc");


// Global variables
const newsId = 0;
let root, config_root, jmgr = null;
const authManager = new Auth("login");
const packageJson = require("../../package.json");


//                         //
//  DUMMY PROFILE HELPER   //
//                         //

function createDummyProfileFile() {
    fs.appendFile(path.join(root, 'launcher_profiles.json'),
        '{' +
        '"profiles": {' +
        '"(Default)": {' +
        '"name": "(Default)",' +
        '"lastVersionId": "unknown"' +
        '}' +
        '}' +
        '}', function (err) {
            if (err) throw err;
            debug('Saved dummy file launcher_profiles.json.');
        });
}

//                         //
//     SPLASH ANIMATION    //
//                         //

function logoAnim(time, exit) {
    const bigLogo = $('.big-logo');
    const loader = $('.loader-background');
    const titleBarContainer = $(".tb-container");
    setTimeout(function () {
        if (exit) {
            bigLogo.addClass("no-transition");
            loader.addClass("no-transition");
        }
        titleBarContainer.addClass("background");
        bigLogo.removeClass("normal").removeClass("clickable").addClass("splash-two");
        loader.removeClass("hidden").addClass("splash");

        setTimeout(function () {
            bigLogo.removeClass("out").addClass("in");
            if (exit) {
                bigLogo.removeClass("no-transition");
                loader.removeClass("no-transition");
            }
        }, 500)
        setTimeout(function () {
            bigLogo.addClass("normal").removeClass("splash").removeClass("splash-two");
            loader.addClass("hidden");
        }, 750)
        setTimeout(function () {
            bigLogo.addClass("drop");
        }, 1150)
        setTimeout(function () {
            bigLogo.removeClass("drop");
            titleBarContainer.removeClass("background");
        }, 1250)
        setTimeout(function () {
            bigLogo.removeClass("in").addClass("out").addClass("clickable");
        }, 1500)

    }, time);
}

$(document).ready(function () {

    const settingsWin = $(".settings-screen");
    const loginWin = $(".login-screen");
    const infoWin = $(".info-screen");

    const applySettings = $("#apply-settings");
    const closeButton = $(".close-btn");

    const launcherBehaviour = $('#launcher-behaviour');
    const ramMinSlider = $('#ram-min');
    const ramMaxSlider = $('#ram-max');
    const ramMinValue = $('#ram-min-value');
    const ramMaxValue = $('#ram-max-value');
    const browseJavaButton = $('#browse-java');
    const resetJavaButton = $('#reset-java');
    const javaPathDisplay = $('#java-path');

    const versionMenuButton = $('.menu-header');
    const versionMenuContainer = $('.menu-container');
    const versionMenuListContainer = $('.menu-list-container');
    const versionList = $('.menu-trigger');

    const addAccountButton = $("#p-add-account");
    const loginOfflineButton = $("#apply-offline");
    const usernameInput = $("#login-offline");
    const loginMsButton = $("#login-ms");

    const userBadge = $("#user-badge");
    const userBadgeHead = $(".head");
    const pTopContainer = $(".p-top-cont");
    const pBottomContainer = $(".p-bottom-cont");
    const pLabelContainer = $(".p-label-container");

    const playButton = $(".play");

    const errorScreen = $(".error-screen");
    const errorText = $(".error-text");

    $('.tb-discord-cont').click(function () {
        shell.openExternal("https://discord.gg/7pPNbUU");
    });
    $('.tb-bug-cont').click(function () {
        shell.openExternal(packageJson.bugs.url);
    });
    $('.tb-info-cont').click(function () {
        infoWin.addClass("shown");
    });
    $('.tb-devtools-cont').click(function () {
        ipcRenderer.send('devtools');
    });
    $('.tb-settings-cont').click(function () {
        showSettings();
    });
    $('.tb-close-cont').click(function () {
        ipcRenderer.send('close-app');
    });

    //                         //
    // ACCOUNTS & LOGIN SCREEN //
    //                         //

    addAccountButton.click(function () {
        loginWin.show();
    });

    loginOfflineButton.click(function () {
        const input = usernameInput.val();
        if (userExists(input)) {
            debug("Username exists: " + input);
            showErrorMessage("To konto już jest dodane.");
        } else if (validateUser(input)) {
            debug("Username validated: " + input);
            addUser(input, "offline");
            loginWin.hide();

        } else {
            showErrorMessage("Podaj poprawny nick.");
            debug("Username wrong: " + input);
        }
        usernameInput.val("");
    });


    loginMsButton.click(function () {
        ipcRenderer.invoke("mslogin").then(async returnValue => {
            let mc = await returnValue;
            if (mc.error) {
                switch (mc.error) {
                    case "error.gui.closed": {
                        showErrorMessage("Anulowano dodawanie konta.");
                        break;
                    }
                    default: {
                        showErrorMessage("Nie udało się dodać konta Microsoft.");
                        break;
                    }
                }
                return;
            }
            const username = returnValue.mc.name;
            if (userExists(username)) {
                debug("Username exists: " + username);
                showErrorMessage("To konto już jest dodane.");
                return;
            } else addUser(username, "microsoft", returnValue);
            loginWin.hide();
        });
    });

    pTopContainer.click(function () {
        toggleUserList();
    });

    function toggleUserList() {
        userBadgeHead.toggleClass('clicked');
        pBottomContainer.toggleClass('shown');
        pLabelContainer.toggleClass('shown');
    }

    function hideUserList() {
        userBadgeHead.removeClass('clicked');
        pBottomContainer.removeClass('shown');
        pLabelContainer.removeClass('shown');
    }


// TODO ERROR HANDLING
    playButton.click(function () {
        playButton.addClass("hidden");

        let user = getCurrentUserObj();
        let version = getVersion();

        let ram = getSettingEntry("ram");
        let javapath = getSettingEntry("javapath");

        if (checkUserUI(user)) return;

        debug("Trying to launch game version " + version.id);
        launchGame(user, version, ram, javapath);
    });

    //                         //
    //      FILE MANAGER       //
    //                         //

    function initFiles() {
        const initPlatform = os.platform();
        const initUser = os.userInfo().username;
        switch (initPlatform) {
            case "win32":
                root = "C:\\Users\\" + initUser + "\\AppData\\Roaming\\.minecraft";
                break;
            case "linux":
                root = path.join("/home", initUser, ".minecraft");
                break;
            case "darwin":
                root = path.join("/", initUser, "Library", "Application Support", "minecraft");
                break;
        }

        config_root = path.join(root, "dcrftlaunch")

        if (!fs.existsSync(root)) fs.mkdirSync(root);
        if (!fs.existsSync(config_root)) fs.mkdirSync(config_root);
        if (!fs.existsSync(path.join(config_root, "java"))) fs.mkdirSync(path.join(config_root, "java"));
        if (!fs.existsSync(path.join(root, "versions"))) fs.mkdirSync(path.join(root, "versions"));
        if (!fs.existsSync(path.join(root, 'launcher_profiles.json'))) createDummyProfileFile();
    }

    function loadJmgr() {
        jmgr = new JavaManager(path.join(config_root, "java"));
        jmgr.onProgress((p, t) => showProgress((p / t) * 100, "Pobieram: Java"));
    }

    //                         //
    //     PROGRESS MANAGER    //
    //                         //

    function showProgress(percentage, label) {
        const loadingBarCont = $('#ls-loading-bar-cont');
        const loadingBar = $('#ls-loading-bar');
        const loadingLabel = $('#loading-label');

        percentage = percentage > 100 ? 100 : percentage;

        loadingBarCont.show();
        loadingBar.css('width', `${percentage}%`);
        loadingLabel.text(label);
    }

    function hideProgress() {
        const loadingBarCont = $('#ls-loading-bar-cont');
        const loadingBar = $('#ls-loading-bar');
        const loadingLabel = $('#loading-label');

        loadingBarCont.hide();
        loadingBar.css('width', `0`);
        loadingLabel.text("");
    }

    //                         //
    //     SETTINGS MANAGER    //
    //                         //

    closeButton.click(function () {
        settingsWin.hide();
        loginWin.hide();
        infoWin.removeClass("shown");
    });

    applySettings.click(function () {
        debug("Saving launcher settings.");
        saveSettings();
        closeButton.click();
    });

    ramMinSlider.on('input', function () {
        ramMinValue.text(`${ramMinSlider.val()}GB`);
    });

    ramMaxSlider.on('input', function () {
        ramMaxValue.text(`${ramMaxSlider.val()}GB`);
    });

    browseJavaButton.click(function () {
        ipcRenderer.invoke("select-java").then(returnValue => {
            javaPathDisplay.data("javapath", returnValue);
            javaPathDisplay.text(returnValue);
        });
    });

    resetJavaButton.click(function () {
        javaPathDisplay.text("Używasz domyślnej Javy");
    });


    function showSettings() {
        let settings = getSettings();

        launcherBehaviour.val(settings.behaviour);
        ramMinSlider.val(settings.ram.min);
        ramMaxSlider.val(settings.ram.max);
        ramMinValue.text(settings.ram.min + "GB");
        ramMaxValue.text(settings.ram.max + "GB");

        let javaPathText = settings.javapath === undefined ? "Używasz domyślnej Javy" : settings.javapath;
        javaPathDisplay.data(settings.javapath);
        javaPathDisplay.text(javaPathText);

        settingsWin.show();
    }

    function getSettings() {
        loadConfig();
        if (nconf.get("settings") == null) saveSettings();
        return nconf.get("settings");
    }

    function getSettingEntry(entry) {
        getSettings();
        return nconf.get("settings:" + entry);
    }

    function saveSettings() {
        let settings = {
            behaviour: launcherBehaviour.val(),
            ram: {
                min: ramMinSlider.val(),
                max: ramMaxSlider.val()
            },
            javapath: javaPathDisplay.data("javapath")
        };
        nconf.set("settings", settings);
        nconf.save();
    }

    //                         //
    //       DCRFT.PL HUD      //
    //                         //

    // TODO View older news
    function news(i) {
        const request = new XMLHttpRequest();
        const newsTypeIcon = $(".newstypeicon")
        const newsTypeIconColor = $(".newstypeiconcolor");

        request.open('GET', 'https://sub3.dcrft.pl/oglapi.php?id=' + i, true);
        request.onload = function () {
            const data = JSON.parse(request.responseText);
            if (request.status < 200 || request.status > 400) debug("Error loading news. HTTP status: " + request.status);
            let desc = data[0];
            let n = 0;
            desc = desc.replace('**', (m) => {
                return (n++ % 2) ? m : '<b>';
            });
            desc = desc.replaceAll('**', '</b>');
            let type = "Ogłoszenie";
            newsTypeIcon.removeClass("fa-star").addClass("fa-newspaper");
            newsTypeIconColor.css("color", "darkseagreen");
            if (data[3] === "1") {
                type = "Event";
                $(".news-type-icon").removeClass("fa-newspaper").addClass("fa-star");
                newsTypeIconColor.css("color", "yellow");
            }

            $(".news-desc").html(desc);
            $(".newstype").html(type);
            $(".news-uploader").html(data[1] + ", " + data[2]);
        }
        request.send();
    }

    function loadServerStatus() {
        $.getJSON("https://api.minetools.eu/ping/dcrft.pl", function (r) {
            const rest = $("#rest");
            if (r.error) {
                rest.html('offline');
                return;
            }
            rest.html(r.players.online + '/100');

        });
    }

    //                         //
    //      CONFIG MANAGER     //
    //                         //

    function saveConfig() {
        nconf.save(function () {
            fs.readFile(path.join(config_root, 'dcrftlaunch.json'), function (err) {
                err = err == null ? "ok" : err;
                debug("Config saving: " + err);
            });
            nconf.load();
        });
    }

    function loadConfig() {
        nconf.file({file: path.join(config_root, 'dcrftlaunch.json')});
        nconf.load();
        nconf.save();
    }

    //                         //
    //     VERSION MANAGER     //
    //                         //

    versionMenuButton.click(function () {
        toggleVersionList();
    });

    function hideVersionList() {
        versionList.addClass("hidden");
        versionMenuContainer.removeClass("shown");
        versionMenuListContainer.hide();
    }

    function toggleVersionList() {
        versionList.toggleClass("hidden");
        versionMenuContainer.toggleClass("shown");
        versionMenuListContainer.toggle();
    }

    function getVersion() {
        return nconf.get("version");
    }

    function getVersionObjFromListItem(item) {
        return {
            custom: item.data("custom"),
            inherit: item.data("inherit"),
            id: item.data("id"),
            type: item.data("type"),
            verid: item.data("verid")
        };
    }

    function addVersionListHandler() {
        const versionListItem = $(".menu-list-item");

        versionListItem.click(function () {

            selectGameVersion(getVersionObjFromListItem($(this)));
            versionMenuButton.click();
            $(".menu-label").text("Minecraft " + $(this).data("id"));
        });

    }

    function filterVersions() {
        const alphaChecked = $('#alpha-filter').prop('checked');
        const betaChecked = $('#beta-filter').prop('checked');
        const snapshotChecked = $('#snapshot-filter').prop('checked');

        $('.menu-list-item').each(function () {
            const type = $(this).data('type');

            if ((alphaChecked && type === 'old_alpha') ||
                (betaChecked && type === 'old_beta') ||
                (snapshotChecked && type === 'snapshot')) {
                $(this).show();
            } else if (type !== 'release') {
                $(this).hide();
            }
        });
    }

    $('#alpha-filter, #beta-filter, #snapshot-filter').on('change', filterVersions);


    function loadVersionBadge() {
        let version = nconf.get("version");
        if (version == null) version = getVersionObjFromListItem($(".menu-list-item"));
        selectGameVersion(version);
        $(".menu-label").text("Minecraft " + version.id);
    }

    function loadVersionList() {
        $.ajaxSetup({
            async: false
        });
        let vList = [];
        $.getJSON('https://launchermeta.mojang.com/mc/game/version_manifest.json', function (data) {
            data.versions.forEach(element => {
                if (element.type === 'release' || element.type === 'snapshot' || element.type === 'old_beta' || element.type === 'old_alpha') vList.push(element)
            });

            const dir = path.join(root, "versions");
            let files = fs.readdirSync(dir);
            files.forEach(file => {
                if (fs.statSync(path.join(dir, file)).isDirectory) {
                    files = fs.readdirSync(path.join(dir, file));
                    files.forEach(json => {
                        if (path.extname(json) === ".json") {
                            $.getJSON(path.join(dir, file, json), function (data) {
                                if ((data.mainClass !== "net.minecraft.client.main.Main" && data.mainClass !== "net.minecraft.launchwrapper.Launch" && data.mainClass != null)) vList.push(data);
                            });
                        }
                    });
                }
            });
        });

        vList.forEach(y => {
            let custom = false;
            let inh = null;
            if ((y.inheritsFrom != null && y.assets != null) || (y.mainClass !== "net.minecraft.client.main.Main" && y.mainClass !== "net.minecraft.launchwrapper.Launch" && y.mainClass != null)) {
                if (y.type !== "old_alpha" && y.type !== "old_beta") {
                    custom = true
                    inh = y.inheritsFrom;
                    debug("Found custom json: " + y.id)
                }
            }
            let verid;
            if (inh != null) verid = inh;
            else if (custom) verid = y.assets;
            else verid = y.id;

            $('#menu-list-container').append(`
            <div class="menu-list-item" data-custom="${custom}" data-inherit="${inh}" data-id="${y.id}" data-type="${y.type}" data-verid="${verid}">${y.id}</div>`);
        });
        filterVersions();
        addVersionListHandler();
    }

    function selectGameVersion(version) {
        debug("User selected version: " + version.id)
        nconf.set("version", version);
        saveConfig();
    }


    //                         //
    //     USER MANAGER        //
    //                         //

    async function tryRefreshToken(userObj) {
        debug("Trying to refresh user token...");
        const xboxManager = await authManager.refresh(userObj.auth.token.parent.msToken);
        const token = await xboxManager.getMinecraft();
        let auth = {
            token: token,
            mc: token.mclc()
        };
        nconf.set("profile:current:auth", auth);
        nconf.set("profile:history:" + userObj.username + ":auth", auth);
        debug("User token refreshed!");
        saveConfig();
    }

    function addUser(user, type, auth) {
        nconf.set("profile:current:username", user);
        nconf.set("profile:current:type", type);
        if (auth) nconf.set("profile:current:auth", auth);

        let history = getHistory();

        if (history[user] === undefined) {
            history[user] = {username: user, type: type};
            if (auth) history[user].auth = auth;
        }


        nconf.set("profile:history", history);

        nconf.save();
        loadConfig();
        selectUser(user, true);
    }

    function removeUser(username) {
        nconf.clear("profile:history:" + username);
        nconf.save();
        loadUserList();
    }

    function selectUser(userName, click) {
        const userFromHistory = getUserFromHistory(userName)
        nconf.set("profile:current", userFromHistory);
        if (userFromHistory.auth) tryRefreshToken(userFromHistory);
        nconf.save();
        loadUserBadge(userFromHistory);
        loadUserList();
        if (click) $('.p-top-cont').click();
    }

    function loadUserBadge(user) {
        userBadge.text(user.username);
        if (user.auth !== undefined) userBadgeHead.css("background-image", "url('https://mc-heads.net/avatar/" + user.auth.token.profile.id + "')").removeClass("steve");
        else userBadgeHead.addClass("steve");
    }

    function getHistory() {
        let history = nconf.get("profile:history");
        if (history === undefined) history = {};
        return history;
    }

    function getUserFromHistory(userName) {
        let userFromHistory = nconf.get("profile:history:" + userName);
        if (userFromHistory === undefined) userFromHistory = {};
        return userFromHistory;
    }

    function addUserListHandler() {

        const userSelectElement = $("span.user-p-list-element");
        const userDeleteElement = $("div.p-list-element-delete");

        userSelectElement.click(function () {
            let user = $(this).text();
            debug("Selected user: " + user);
            selectUser(user, true);
        });

        userDeleteElement.click(function () {
            const username = $(this).data("username");

            if (getCurrentUserObj().username === username) {
                showErrorMessage("Nie można usunąć konta, które jest aktualnie wybrane.")
                debug("Tried removing currently logged user: " + username);
            } else {
                removeUser(username);
                debug("Deleting user: " + username);
            }
            hideUserList();
        });

    }

    function loadUserList() {
        let history = getHistory();
        const container = $('.p-element-container');

        container.empty();

        $.each(history, function (user) {
            container.append(`<li class="p-list-element">
                                <span class="user-p-list-element">${user}</span>
                                <div class="p-list-element-delete" data-username=${user}><i class="fa-solid fa-xmark"></i></div>
                              </li>`);
        });
        addUserListHandler();

    }

    function getCurrentUserName() {
        return nconf.get("profile:current:username");
    }

    function getCurrentUserObj() {
        return nconf.get("profile:current");
    }

    function validateUser(user) {
        return user === undefined ? false : /^\w{3,16}$/i.test(user);
    }

    function checkUserUI(user) {
        if (user == null) {
            playButton.addClass("error");
            playButton.removeClass("hidden");
            setTimeout(function () {
                playButton.removeClass("error");
            }, 500);
            showErrorMessage("Nie utworzono konta!");
            return true;
        }
        return false;
    }

    function userExists(user) {
        let history = getHistory();
        return !(history[user] === undefined);
    }

    //                         //
    //          LAUNCH         //
    //                         //

    function launchGame(user, version, ram, javapath) {

        hideVersionList();
        hideUserList();

        const jmgrVer = /[a-zA-Z]/.test(version.verid) ? "1.5" : version.verid + "";

        (async () => {
            let opts = {
                authorization: Authenticator.getAuth(user.username),
                root: root,
                version: {
                    number: version.id + "",
                    type: version.type
                },
                memory: {
                    min: ram.min + "G",
                    max: ram.max + "G"
                },
                javaPath: await jmgr.use(jmgrVer),
            }

            if (version.custom != null) {
                opts.version.custom = version.id + "";
                opts.version.number = version.verid + "";
            }

            if (user.auth) opts.authorization = user.auth.mc;

            debug("Options are set.");
            launcher.launch(opts);

            launcher.on('data', (e) => console.log(e));

            launcher.on('progress', (e) => {
                let progress = (e.task / e.total) * 100;
                if (progress < 100) showProgress(progress, "Ładowanie gry");
                else setTimeout(function () {
                    hideProgress()
                }, 1500);
            });

            launcher.on('arguments', () => {
                setRPC("Minecraft " + opts.version.number + "");
                ipcRenderer.send('toggleLauncher', getSettingEntry("behaviour"));
            });

            launcher.on('close', () => {
                logoAnim(0, true);
                hideProgress();
                playButton.removeClass("hidden");
                setRPC("W menu");
                debug("Game exited.")
                ipcRenderer.send('toggleLauncher', "show");
            });

            launcher.on('debug', (e) => {
                console.log(e);
                if (e.includes("MCLC]: Failed to start due to")) {
                    hideProgress();
                    playButton.removeClass("hidden");
                    logoAnim(0, true);
                    debug("Exited with error.")
                    setTimeout(function () {
                        showErrorMessage("Wystąpił błąd przy uruchamianiu gry.")
                    }, 1000);
                }
            });


        })();
    }


    //                         //
    //          MISC           //
    //                         //

    function loadLauncherVersion() {
        const launcherVerCont = $(".tb-version-cont");
        launcherVerCont.text(launcherVerCont.text() + " " + packageJson.version);
    }

    function showErrorMessage(text) {
        errorScreen.show();
        errorText.text(text);

        setTimeout(function () {
            errorScreen.fadeOut();
        }, 1500);
    }

    $('.big-logo.logo-image').click(function () {
        shell.openExternal("https://dcrft.pl");
    });

    //                         //
    //          INIT           //
    //                         //

    function launcherInit() {
        loadLauncherVersion();
        loadRPC();
        initFiles();
        loadConfig();

        if (getCurrentUserObj() !== undefined) {
            selectUser(getCurrentUserName(), false);
            loadUserBadge(getCurrentUserObj());
            loadUserList();
        }

        loadVersionList();
        loadVersionBadge();
        loadJmgr();
        news(newsId);
        loadServerStatus();
        logoAnim(300, false);
    }

    //                         //
    //          LOGIC          //
    //                         //

    launcherInit();

});

