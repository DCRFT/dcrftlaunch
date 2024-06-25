const {ipcRenderer} = require('electron');
const $ = require("jquery");
const utils = require('../utils.js');
const os = require('os');
const path = require('node:path')
const fs = require("node:fs");
const {debug} = require("../utils");
const newsId = 0;
const nconf = require("nconf")
const RPC = require("discord-rpc");

let root = null;

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
    if (!fs.existsSync(root)) fs.mkdirSync(root);
    if (!fs.existsSync(path.join(root, "versions"))) fs.mkdirSync(path.join(root, "versions"));
    if (!fs.existsSync(path.join(root, 'launcher_profiles.json'))) createDummyProfileFile();
    //if (!fs.existsSync(path.join(root, 'dcrftlaunch.json'))) { fs.writeFileSync(path.join(root, 'dcrftlaunch.json'), ''); debug("Created dcrftlaunch.json") }
}

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

function logoAnim(time) {
    const bigLogo = $('.big-logo');
    const loader = $('.loader-background');

    setTimeout(function () {

        bigLogo.removeClass("normal").addClass("splash-two");
        loader.removeClass("hidden").addClass("splash");

        setTimeout(function () {
            bigLogo.removeClass("out").addClass("in");
        }, 500)

        setTimeout(function () {
            bigLogo.addClass("normal").removeClass("splash").removeClass("splash-two");
            loader.addClass("hidden");
        }, 750)

        setTimeout(function () {
            bigLogo.removeClass("in").addClass("out");
        }, 1500)

    }, time);

}

$(document).ready(function () {

    const settingsWin = $(".settings-screen");
    const loginWin = $(".login-screen");

    const applySettings = $("#apply-settings");
    const closeButton = $(".close-btn");

    const ramMinSlider = $('#ram-min');
    const ramMaxSlider = $('#ram-max');
    const ramMinValue = $('#ram-min-value');
    const ramMaxValue = $('#ram-max-value');
    const browseJavaButton = $('#browse-java');
    const resetJavaButton = $('#reset-java');
    const javaPathDisplay = $('#java-path');

    const versionMenuButton = $('.menu-header');
    const versionMenuContainer = $('.menu-container');
    const versionList = $('.menu-trigger');

    const addAccountButton = $("#p-add-account");
    const loginOfflineButton = $("#apply-offline");
    const usernameInput = $("#login-offline");

    const userBadge = $("#user-badge");


    $('.tb-close-cont').click(function () {
        ipcRenderer.send('close-app');
    });
    $('.tb-devtools-cont').click(function () {
        ipcRenderer.send('devtools');
    });
    $('.tb-settings-cont').click(function () {
        settingsWin.show();
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
        } else if (validateUser(input)) {
            debug("Username validated: " + input);
            addUser(input, "offline");
            loginWin.hide();

        } else
            debug("Username wrong: " + input);
    });


    $('.p-top-cont').click(function () {
        $('.head').toggleClass('clicked');
        $(".p-bottom-cont").toggleClass('shown');
        $(".p-label-container").toggleClass('shown');

    });

    closeButton.click(function () {
        settingsWin.hide()
        loginWin.hide()
    });


    ramMinSlider.on('input', function () {
        ramMinValue.text(`${ramMinSlider.val()}GB`);
    });

    ramMaxSlider.on('input', function () {
        ramMaxValue.text(`${ramMaxSlider.val()}GB`);
    });

    browseJavaButton.click(function () {
        ipcRenderer.invoke("select-java").then(returnValue => {
            javaPathDisplay.text(returnValue);
        });
    });

    resetJavaButton.click(function () {
        javaPathDisplay.text("Domyślna");
    });


    versionMenuButton.click(function () {
        versionList.toggleClass("hidden");
        versionMenuContainer.toggleClass("shown");
    });


    function news(i) {
        const request = new XMLHttpRequest();
        request.open('GET', 'https://sub3.dcrft.pl/oglapi.php?id=' + i, true);
        request.onload = function () {
            const data = JSON.parse(request.responseText);
            if (request.status < 200 || request.status > 400) utils.debug("Error loading news. HTTP status: " + request.status);
            let desc = data[0];
            let n = 0;
            desc = desc.replace('**', (m, i, og) => {
                return (n++ % 2) ? m : '<b>';
            });
            desc = desc.replaceAll('**', '</b>');
            type = "Ogłoszenie";
            $(".newstypeicon").removeClass("fa-star").addClass("fa-newspaper");
            $(".newstypeiconcolor").css("color", "darkseagreen");
            if (data[3] == "1") {
                type = "Event";
                $(".news-type-icon").removeClass("fa-newspaper").addClass("fa-star");
                $(".newstypeiconcolor").css("color", "yellow");
            }


            $(".news-desc").html(desc);
            $(".newstype").html(type);
            $(".news-uploader").html(data[1] + ", " + data[2]);
        }
        request.send();
    }

    $.getJSON("https://api.minetools.eu/ping/dcrft.pl", function (r) {
        if (r.error) {
            $('#rest').html('offline');
            return;
        }
        $('#rest').html(r.players.online + '/100');

    });

    function saveConfig() {
        nconf.save(function (err) {
            fs.readFile(path.join(root, 'dcrftlaunch.json'), function (err, data) {
                err = err == null ? "ok" : err;
                debug("Config saving: " + err);
            });
        });
    }

    function loadConfig() {
        nconf.file({file: path.join(root, 'dcrftlaunch.json')});
        nconf.load();
        saveConfig();
    }


    function loadRPC() {
        const rpc = new RPC.Client({
            transport: "ipc"
        });
        const clientId = "949374226484314142";

        rpc.on("ready", () => {
            rpc.setActivity({
                startTimestamp: new Date(),
                state: "W menu",
                largeImageKey: "dcl4it",
                largeImageText: "DragonCraft",
                details: "Launcher Minecraft dla DCRFT.PL",
                buttons: [{label: "DragonCraft", url: "http://dcrft.pl"}, {
                    label: "Pobierz launcher!",
                    url: "http://dcrft.pl/launcher"
                }]
            })

        });


        rpc.login({
            clientId: clientId
        }).catch(function (r) {
            debug("Couldn't connect to Discord: " + r)
        });
    }

    function addUser(user, type, auth) {
        nconf.set("profile:current:username", user);
        nconf.set("profile:current:type", type);

        let history = getHistory();

        if (history[user] === undefined) {
            history[user] = {type: type};
            if (auth) history[user].auth = auth;
        }


        nconf.set("profile:history", history);

        nconf.save();
        loadConfig();
        selectUser(user);
    }

    function selectUser(user) {
        nconf.set("profile:current:username", user);
        nconf.save();
        loadUserBadge(user);
        loadUserList();
        $('.p-top-cont').click();
    }

    function loadUserBadge(user) {
        userBadge.text(user);
    }

    function getHistory() {
        let history = nconf.get("profile:history");
        if (history === undefined) history = {};
        return history;
    }

    function addUserListHandler() {
        const userSelectElement = $("li.user-p-list-element");
        userSelectElement.click(function () {
            let user = $(this).text();
            debug("Selected user: " + user);
            selectUser(user);
        })
    }

    function loadUserList() {
        let history = getHistory();
        const container = $('.p-element-container');

        container.empty();

        console.log(history)

        $.each(history, function (user, details) {
            container.append(`<li class="p-list-element user-p-list-element">${user}</li>`);
        });
        addUserListHandler();

    }

    function getUser() {
        return nconf.get("profile:current:username");
        ;
    }

    function validateUser(user) {

        return user === undefined ? false : /^\w{3,16}$/i.test(user);
    }

    function userExists(user) {
        let history = getHistory();
        return !(history[user] === undefined);
    }


    // LOGIC //

    loadRPC();

    initFiles();
    loadConfig();

    if (!(getUser() === undefined)) {
        loadUserBadge(getUser());
        loadUserList();
    }

    debug("Validating username result: " + validateUser(getUser))

    news(newsId);
    logoAnim(0);


});

