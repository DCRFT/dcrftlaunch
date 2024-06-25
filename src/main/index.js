const {ipcRenderer} = require('electron');
const $ = require("jquery");
const utils = require('../utils.js');

const newsId = 0;

function startupAnim() {
    const bigLogo = $('.big-logo');
    const loader =$('.loader-background');

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

}

$(document).ready(function () {

    $('.tb-close-cont').click(function () {
        ipcRenderer.send('close-app');
    })
    $('.tb-devtools-cont').click(function () {
        ipcRenderer.send('devtools');
    })
    $('.tb-settings-cont').click(function () {
    })


    $('.head').click(function() {
        $(this).toggleClass('clicked');
        $(".p-bottom-cont").toggleClass('shown');
        $(".p-label-container").toggleClass('shown');

    });


    function news(i) {
        const request = new XMLHttpRequest();
        request.open('GET', 'https://sub3.dcrft.pl/oglapi.php?id=' + i, true);
        request.onload = function() {
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

    $.getJSON("https://api.minetools.eu/ping/dcrft.pl", function(r) {
        if (r.error) { $('#rest').html('offline'); return; }
        $('#rest').html(r.players.online + '/100');

    });




    news(newsId);


    setTimeout(function () {
        startupAnim();
    }, 1000);



});

