// ==UserScript==
// @author         uniQ
// @name           Steam Item Information Viewer
// @icon           https://store.steampowered.com/favicon.ico
// @updateURL      https://raw.githubusercontent.com/uniQIndividual/SteamUserscripts/master/Item-Information-Viewer.js
// @description    Displays additional information provided by Steam's API and adds functionality to hidden items
// @include        /^https:\/\/steamcommunity\.com\/sharedfiles\/filedetails\/\?((\d|\w)+=(\d|\w)*&)*id=\d{0,20}/
// @version        1.0
// ==/UserScript==


// idea from https://greasyfork.org/es/users/2611-alvaro but substantially changed

function getData() {
  var id = new URL(location.href).searchParams.get("id");
  $J.ajax({
    method: "POST",
    url: "https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v0001/",
    data: "itemcount=1&publishedfileids[0]=" + id + "&format=json",
    success: function(response) {
      try {
        let data = response.response.publishedfiledetails[0];
        let fileurl = data.file_url;
        let text = "This are the variables associated with this item.<br>Note that only values from the API are displayed.<br><br>";
        for (var key in data) {
          if (Object.prototype.toString.call(data[key]) === '[object Array]') {
            text += '<b>' + sanitize(key) + '</b>: [';
            for (var i = 0; i < data[key].length; i++) {
              text += sanitize(JSON.stringify(data[key][i], null, 4));
            }
            text += ']';
          } else {
            switch (key) {
              case 'creator':
                text += '<b>' + sanitize(key) + '</b>: ' +
                  '<a href=\"https://steamcommunity.com/profiles/' + sanitizeURL(data[key]) + '/\">' + sanitize(data[key]) + '</a><br>';
                break;
              case 'file_size':
                text += '<b>' + sanitize(key) + '</b>: ' +
                sanitize(data[key]) + '<span class="bb_link_host">( ' + (sanitize(data[key]) / 1024 / 1024).toFixed(2) + ' MB )</span><br>';
                break;
              case 'time_created':
              case 'time_updated':
                text += '<b>' + sanitize(key) + '</b>: ' +
                  sanitize(data[key]) + '<span class="bb_link_host">( ' + new Date(sanitize(data[key]) * 1000).toString() + ')</span><br>';
                break;
              default:
                text += '<b>' + sanitize(key) + '</b>: ' +
                  (validURL(data[key]) ? '<a href=\"' + sanitizeURL(data[key]) + '\">' + sanitize(data[key]) + '</a>' : sanitize(data[key])) + '<br>';
            }
          }
        }

        // add item options
        text += '<br><br><div class=\"workshopItemControls\"><div class=\"workshopItemRatings\">';
        text += '<span onclick=\"itemUpVote();\" id=\"itemUpVoteBtn\" class=\"general_btn voteUp\">' +
          '&nbsp;</span><span onclick=\"itemDownVote();\" id=\"itemDownVoteBtn\" class=\"general_btn voteDown\">&nbsp;</span>';
        text += '<span onclick=\"itemFavorite();\" id=\"itemFavoriteBtn\" class=\"general_btn favorite tooltip \"><div class=\"favoriteText\">' +
          '<div class=\"favoriteOption addfavorite selected\">Favorite</div></div></span>';
        text += '<span onclick=\"itemReport();\" id=\"itemReportBtn\" class=\"general_btn report tooltip\">&nbsp;</span>';
        text += '</div></div>';

        ShowAlertDialog("Output", text);

        function validURL(str) { // from https://stackoverflow.com/questions/5717093/check-if-a-javascript-string-is-a-url
          var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
            '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
            '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
            '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
            '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
            '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
          return !!pattern.test(str);
        };

        function sanitize(string) { // very basic sanitizion in case Steam does not properly sanitize their output
          // using https://stackoverflow.com/questions/2794137/sanitizing-user-input-before-adding-it-to-the-dom-in-javascript/48226843#48226843
          string = string.toString();
          const map = {
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            "/": '&#x2F;',
            "`": '&grave;',
          };
          const reg = /[<>"'/`]/ig;
          return string.replace(reg, (match) => (map[match]));
        }

        function sanitizeURL(string) {
          string = string.toString();
          const map = {
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            "`": '&grave;',
          };
          const reg = /[<>"'`]/ig;
          return string.replace(reg, (match) => (map[match]));
        }
      } catch (e) {
        console.log(e);
      }
    },
    error: function(reponse) {
      console.log(reponse);
    }
  });
}

function itemReport() {
  ShowPromptDialog("Repor this item", "Please enter the reason", "Start", "Cancel", "").done((reason) => {
    $J.post('https://steamcommunity.com/sharedfiles/reportitem', {
      'id': new URL(location.href).searchParams.get("id"),
      'description': reason,
      'sessionid': g_sessionID
    }).done((result) => {
      ShowAlertDialog("Report sent", "")
      $('itemReportBtn').addClassName('toggled');
    }).fail((errorMsg) => {
      console.log(errorMsg);
      ShowAlertDialog('Error', 'There was an error while sending your request.<br>Perhaps you are not logged in or do not have permission?')
    });

  });
};

function itemUpVote() {
  $J.post('https://steamcommunity.com/sharedfiles/voteup', {
    'id': new URL(location.href).searchParams.get("id"),
    'sessionid': g_sessionID
  }).done((result) => {
    if (result.items == undefined) {
      ShowAlertDialog('Error', 'There was an error while sending your request.<br>Perhaps you are not logged in or do not have permission?')
    } else {
      $('itemUpVoteBtn').addClassName('toggled');
      $('itemDownVoteBtn').removeClassName('toggled');
    }
  }).fail((errorMsg) => {
    console.log(errorMsg);
    ShowAlertDialog('Error', 'There was an error while sending your request.<br>Perhaps you are not logged in or do not have permission?')
  });
}

function itemDownVote() {
  $J.post('https://steamcommunity.com/sharedfiles/votedown', {
    'id': new URL(location.href).searchParams.get("id"),
    'sessionid': g_sessionID
  }).done((result) => {
    if (result.items == undefined) {
      ShowAlertDialog('Error', 'There was an error while sending your request.<br>Perhaps you are not logged in or do not have permission?')
    } else {
      $('itemUpVoteBtn').removeClassName('toggled');
      $('itemDownVoteBtn').addClassName('toggled');
    }
  }).fail((errorMsg) => {
    console.log(errorMsg);
    ShowAlertDialog('Error', 'There was an error while sending your request.<br>Perhaps you are not logged in or do not have permission?')
  });
}

function itemFavorite() {
  ShowConfirmDialog("Favorite", "Do you  want to add or remove this item from your favorites?",
    "Add to favorites", "Cancel", "Remove from favorites").done((choice) => {
    if (choice == 'OK') {
      $J.post('https://steamcommunity.com/sharedfiles/favorite', {
        'id': new URL(location.href).searchParams.get("id"),
        'appid': 0, // apparently this doesn't matter
        'sessionid': g_sessionID
      }).done((result) => {
        if (result != '') { // how is this even a thing?
          ShowAlertDialog('Error', 'There was an error while sending your request.<br>Perhaps you are not logged in or do not have permission?')
        } else {
          $('itemFavoriteBtn').addClassName('toggled');
        }
      }).fail((errorMsg) => {
        console.log(errorMsg);
        ShowAlertDialog('Error', 'There was an error while sending your request.<br>Perhaps you are not logged in or do not have permission?')
      });
    }
    if (choice == 'SECONDARY') {
      $J.post('https://steamcommunity.com/sharedfiles/unfavorite', {
        'id': new URL(location.href).searchParams.get("id"),
        'appid': 0,
        'sessionid': g_sessionID
      }).done((result) => {
        if (result != '') {
          ShowAlertDialog('Error', 'There was an error while sending your request.<br>Perhaps you are not logged in or do not have permission?')
        } else {
          $('itemFavoriteBtn').removeClassName('toggled');
        }
      }).fail((errorMsg) => {
        console.log(errorMsg);
        ShowAlertDialog('Error', 'There was an error while sending your request.<br>Perhaps you are not logged in or do not have permission?')
      });
    }
  });
}

function initialize(id) {
  // check for missing Steam libraries
  // not ideal, could be replaced by the actual content
  function testCSSWorkshop() {
    var sheets = document.styleSheets,
      o = {};
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].href.includes('https://community.cloudflare.steamstatic.com/public/css/skin_1/workshop.css')) {
        return true;
      }
    }
    return false;
  }
  if (!testCSSWorkshop()) {
    var cssWorkshop = document.createElement('link');
    cssWorkshop.href = 'https://community.cloudflare.steamstatic.com/public/css/skin_1/workshop.css';
    cssWorkshop.rel = "stylesheet";
    cssWorkshop.type = "text/css";
    document.head.appendChild(cssWorkshop);
  }

  function testCSSWorkshopItem() {
    var sheets = document.styleSheets,
      o = {};
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].href.includes('https://community.cloudflare.steamstatic.com/public/css/skin_1/workshop_itemdetails.css')) {
        return true;
      }
    }
    return false;
  }
  if (!testCSSWorkshopItem()) {
    var cssWorkshopItem = document.createElement('link');
    cssWorkshopItem.href = 'https://community.cloudflare.steamstatic.com/public/css/skin_1/workshop_itemdetails.css';
    cssWorkshopItem.rel = "stylesheet";
    cssWorkshopItem.type = "text/css";
    document.head.appendChild(cssWorkshopItem);
  }

  var button = document.createElement('a');
  button.setAttribute('class', 'btn_darkblue_white_innerfade btn_border_2px btn_medium');
  button.setAttribute('style', ' margin-top: 10px;');

  button.innerHTML = '<span class="subscribeText" style=\"padding-left: 15px;\">' +
    '<div class="subscribeOption subscribe selected" id="getDataButton" onClick=\"getData()\">Display more information</div>' +
    '</span>';

  if ($('message')) { // hidden item
    $('message').append(button);
  } else if ($('ItemControls')) { // regular content
    $('ItemControls').append(button);
  }
}
(() => {
  var script = document.createElement('script');
  script.innerHTML = getData.toString() +
    itemReport.toString() +
    itemUpVote.toString() +
    itemDownVote.toString() +
    itemFavorite.toString() +
    "(" + initialize.toString() + ")()";
  document.body.appendChild(script);
})();
