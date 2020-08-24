// ==UserScript==
// @author         uniQ
// @name           Steam Item Information Viewer
// @icon           https://store.steampowered.com/favicon.ico
// @updateURL      https://github.com/uniQIndividual/SteamUserscripts/raw/master/Item-Information-Viewer.user.js
// @description    Displays additional information provided by Steam's API and adds functionality to hidden items
// @include        /^https:\/\/steamcommunity\.com\/sharedfiles\/filedetails\/\?((\d|\w)+=(\d|\w)*&)*id=\d{0,20}/
// @version        1.2.2
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
        let text = "These are the variables associated with this item.<br>Note that only values from the API are displayed.<br><br>";
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
              case 'creator_app_id':
              case 'consumer_app_id':
                text += '<b>' + sanitize(key) + '</b>: ' +
                  sanitize(data[key]) + '<span class="bb_link_host">( <a href=\"https://steamdb.info/app/' +
                  sanitize(data[key]) + '/\">' + appidLookup(sanitize(data[key])) + '</a> )</span><br>';
                break;
              case 'time_created':
              case 'time_updated':
                text += '<b>' + sanitize(key) + '</b>: ' +
                  sanitize(data[key]) + '<span class="bb_link_host">( ' + new Date(sanitize(data[key]) * 1000).toString() + ')</span><br>';
                break;
              case 'file_url':
              case 'preview_url':
                text += '<b>' + sanitize(key) + '</b>: ' +
                  (validURL(data[key]) ? '<a href=\"' + sanitizeURL(data[key]) + '\">' + sanitize(data[key]) + '</a>' : sanitize(data[key])) + '<br>';
                break;
              default:
                text += '<b>' + sanitize(key) + '</b>: ' + sanitize(data[key]) + '<br>';
            }
          }
        }

        // add item options
        text += '<br><br><br><div class=\"workshopItemControls\"><div class=\"workshopItemRatings\">';
        text += '<span onclick=\"itemUpVote();\" id=\"itemUpVoteBtn\" class=\"general_btn voteUp\">' +
          '&nbsp;</span><span onclick=\"itemDownVote();\" id=\"itemDownVoteBtn\" class=\"general_btn voteDown\">&nbsp;</span>';
        text += '<span onclick=\"itemFavorite();\" id=\"itemFavoriteBtn\" class=\"general_btn favorite tooltip \"><div class=\"favoriteText\">' +
          '<div class=\"favoriteOption addfavorite selected\">Favorite</div></div></span>';
        text += '<span onclick=\"itemReport();\" id=\"itemReportBtn\" class=\"general_btn report tooltip\">&nbsp;</span>';
        text += (data.creator ? '' : '<span onclick=\"itemLoadComments()\" class=\"general_btn share tooltip\" ' +
          'id=\"ItemCommentBtn\">Load comments </span>');
        text += '</div></div>';

        // add comments
        text += '<br>' +
          '<div class=\"commentthread_entry\"><div class=\"commentthread_user_avatar playerAvatar offline\">' +
          '</div><div class=\"commentthread_entry_quotebox\"><textarea rows=\"1\" class=\"commentthread_textarea\" id=\"commentthreadItemTextarea\"' +
          ' placeholder=\"Add a comment\" style=\"overflow: hidden; height: 40px;\"></textarea></div><div class=\"commentthread_entry_submitlink\" style=\"\">' +
          '<a class=\"btn_grey_black btn_small_thin\" href=\"javascript:CCommentThread.FormattingHelpPopup( \'PublishedFile_Public\' );\">' +
          '	<span>Formatting help</span></a>&nbsp;&nbsp;&nbsp;<span class=\"btn_green_white_innerfade btn_small\" \"><span onclick=\"itemComment(\'' +
          (data.creator ? sanitize(data.creator) : '') + '\', $(\'commentthreadItemTextarea\').value);\">Post Comment</span></span>' +
          '</div><div class=\"commentthread_entry_error\" id=\"commentthread_entry_error\"></div></div>';
        text += '<br>' +
          '<div class=\"commentthread_comment_container\" style=\"max-width: ' +
          window.screen.availWidth * 0.8 + 'px\" id=\"itemCommentSection\"></div><br><br>';

        let storage = document.createElement('div');
        storage.setAttribute('style', 'visibility: hidden;position: absolute;top: -9999px;');
        storage.setAttribute('id', 'storage');
        document.body.appendChild(storage);
        $('storage').innerHTML = text;

        let creatorID = document.createElement('div');
        creatorID.setAttribute('style', 'visibility: hidden;position: absolute;top: -9999px;');
        creatorID.setAttribute('id', 'creatorID');
        document.body.appendChild(creatorID);
        $('creatorID').innerHTML = data.creator ? sanitize(data.creator) : '';

        if (data.creator) {
          itemLoadComments(data.creator);
        } else if (document.getElementsByTagName('textarea') > 1) { // alternative methods of acquiring the creator id
          if (document.getElementsByTagName('textarea')[1].id.includes('commentthread_PublishedFile')) {
            $('creatorID').innerHTML = document.getElementsByTagName('textarea')[1].id.match(/\d{17}/)[0]; //
            itemLoadComments(data.creator);
          } else {
            ShowAlertDialog("Output", text);
            $('storage').innerHTML = '';
          }
        } else {
          ShowAlertDialog("Output", text);
          $('storage').innerHTML = '';
        }

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

        function appidLookup(string) {
          string = string.toString();
          const map = {
            "7": 'Steam Client',
            '440': 'Team Fortress 2',
            "480": 'Spacewar',
            '730': 'Counter-Strike: Global Offensive;',
            '753': 'Steam',
            "754": 'Steam Economy',
            "760": 'Steam Screenshots',
            "765": 'Greenlight',
            "766": 'Steam Workshop',
            "767": 'Steam Artwork',
            "202351": 'Beta Access to the New Steam Community',
            "248210": 'Game Library Sharing Access',
            "223910": 'Saxxy Awards 2012',
            "261310": '3rd Annual Saxxy Awards',
            "321770": '4rd Annual Saxxy Awards',
            "405270": '5rd Annual Saxxy Awards',
            "551410": '6rd Annual Saxxy Awards',
            "744350": 'Steam Chat Images',
            "807210": '7rd Annual Saxxy Awards',
            "1016370": 'Steam Forum Images',
            '1070560': 'Steam Linux Runtime',
            "1182480": 'TestApp',
          };
          return map[string] ? map[string] : 'Look up on SteamDB';
        }
      } catch (e) {
        ShowAlertDialog("Error", "The request failed.<br>Please check the console log.")
        console.log(e);
      }
    },
    error: function(reponse) {
      ShowAlertDialog("Error", "The request failed.<br>Please check the console log.")
      console.log(reponse);
    }
  });
}

function itemLoadComments(userID) {
  if (userID) {
    let modalWindows = document.getElementsByClassName('newmodal_content');
    if ($('storage').innerHTML == '' && modalWindows.length > 0) {
      $('itemCommentSection').innerHTML = '';
      $('storage').innerHTML = modalWindows[modalWindows.length - 1].children[0].innerHTML;
    }
    $J.post('https://steamcommunity.com/comment/PublishedFile_Public/render/' + userID + '/' + new URL(location.href).searchParams.get("id") + '/', {
      'count': 50
    }).done((result) => {
      let text = $('storage').innerHTML;

      result.comments_html = result.comments_html.replace(/href=\"javascript:CCommentThread/, '' +
        'href=\"javascript:setTimeout(itemLoadComments(\'' + result.name.match(/\d{17}/)[0] +
        '\'), 1500 );CCommentThread'); // ensure the overlay is refreshed on comment deletion

      if (result.success) {
        result.comments_html = result.comments_html == "" ? "<span class=\"bb_link_host\">(No comments were found)</span>" : result.comments_html;
      } else {
        result.comments_html = "<span class=\"bb_link_host\">(There was an error loading the comments)</span>";
      }

      text = text.slice(0, text.indexOf('id=\"itemCommentSection\">') + 24) + result.comments_html +
        text.slice(text.indexOf('id=\"itemCommentSection\">') + 24);
      if (document.getElementsByClassName('newmodal_content').length > 0) { //dismiss older overlays
        document.getElementsByClassName('newmodal_background')[0].click()
      }

      ShowAlertDialog("Output", text);
      $('storage').innerHTML = '';
    }).fail((errorMsg) => {
      let text = $('storage').innerHTML;
      console.log("Could not retrive comments");
      console.log(errorMsg);
      if (document.getElementsByClassName('newmodal_content').length > 0) {
        document.getElementsByClassName('newmodal_background')[0].click()
      }
      ShowAlertDialog("Output", text);
      $('storage').innerHTML = '';
    });
  } else {
    if ($('creatorID').innerHTML == '') {
      ShowPromptDialog("Comments", "The script couldn't find the creator.<br>Please enter the Steam64ID of the item creator:",
        "Load comments", "Cancel").done((input) => {
        if (/^\d{17}$/.test(input)) {
          $('creatorID').innerHTML = input;
          itemLoadComments(input);
        } else {
          itemLoadComments();
        }
      });
    } else {
      itemLoadComments($('creatorID').innerHTML);
    }
  }
}

function itemReport() {
  ShowPromptDialog("Report this item", "Please enter the reason", "Start", "Cancel", "").done((reason) => {
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

function itemComment(userID, comment) {
  if (userID != undefined && userID != '') {
    $J.post('https://steamcommunity.com/comment/PublishedFile_Public/post/' + userID + '/' + new URL(location.href).searchParams.get("id") + '/', {
      'comment': comment,
      'sessionid': g_sessionID
    }).done((result) => {
      if (result) {
        if (result.success) {
          itemLoadComments(userID);
          return;
        }
      }
      ShowAlertDialog('Error', 'There was an error while sending your request.<br>Perhaps you are not logged in or do not have permission?')
    }).fail((errorMsg) => {
      console.log(errorMsg);
      ShowAlertDialog('Error', 'There was an error while sending your request.<br>Perhaps you are not logged in or do not have permission?')
    });
  } else {

    if ($('creatorID').innerHTML == '') {
      ShowPromptDialog("Comments", "The script couldn't find the creator.<br>Please enter the Steam64ID of the item creator:",
        "Add comment", "Cancel").done((input) => {
        if (/^\d{17}$/.test(input)) {
          $('creatorID').innerHTML = input;
          itemComment(input, comment);
        } else {
          itemComment('', comment);
        }
      });
    } else {
      itemComment($('creatorID').innerHTML, comment);
    }
  }
};

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

  var button = document.createElement('div');
  button.setAttribute('style', ' width: 100%;');

  button.innerHTML = '<a class=\"btn_darkblue_white_innerfade btn_border_2px btn_medium\" style=\" margin-top: 10px;\">' +
    '<span class="subscribeText" style=\"padding-left: 15px;\">' +
    '<div class="subscribeOption subscribe selected" id="getDataButton" onClick=\"getData()\">Display more information</div>' +
    '</span></a>';

  if ($('message')) { // hidden item
    $('message').append(button);
  } else if ($('ItemControls')) { // regular content
    $('ItemControls').append(button);
  }
}
(() => {
  var script = document.createElement('script');
  script.innerHTML = getData.toString() +
    itemLoadComments.toString() +
    itemReport.toString() +
    itemUpVote.toString() +
    itemDownVote.toString() +
    itemFavorite.toString() +
    itemComment.toString() +
    "(" + initialize.toString() + ")()";
  document.body.appendChild(script);
})();
