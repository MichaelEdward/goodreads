// This script is run when visiting the Overdrive search libraries page

// save selected OverDrive library
function addLibrary(libraryName, libraryLink) {
	chrome.storage.sync.get("libraries", function(obj) {
		libraries = obj["libraries"]
		if (!libraries) {
			libraries = {}
			chrome.storage.sync.set({
				libraries: libraries
			});
		}

		libraries[libraryName] = libraryLink;
		libraries = chrome.storage.sync.set({
			libraries: libraries
		}, null);
	});
}

// set the AG link text to either Add or Remove Library
function setLinkText(libraryResultElement) {
	return function(obj) {
		libraries = obj["libraries"];
		libraryName = libraryResultElement.parent().find(".AGtitle").text().replace(/[^ -~]+/g, "").replace(/^\s+|\s+$/g, '');
		if (libraries[libraryName]) {
			libraryResultElement.text("Remove " + libraryName + " from Available Goodreads");
		} else {
			libraryResultElement.text("Add this library to Available Goodreads");
		}
	}
}

// check each of the AG links for updating
function updateLinkText() {
	$("a.AGselect").each(function() {
		libraryResultElement = $(this);
		if (libraryResultElement.size() > 0) {
			chrome.storage.sync.get("libraries", setLinkText(libraryResultElement));
		}
	});
}

// find the .lib.overdrive.com URL for the library
function setOverdriveURL(libraryResultElement, libraryName, websiteSelector) {
	return function(obj) {
		libraries = obj["libraries"];
		// if the library was already added, then remove it
		if (libraries[libraryName]) {
			delete libraries[libraryName];
			libraries = chrome.storage.sync.set({
				libraries: libraries
			}, null);
			libraryResultElement.text("Add this library to Available Goodreads");
		} else { // else add the library
			// if the library link points to overdrive, then simply add it
			websiteLinkTag = libraryResultElement.parent().find(websiteSelector);
			libraryLink = parseUri(websiteLinkTag.attr("href"))["host"];
			if (libraryLink.indexOf('lib.overdrive.com') >= 0) {
				addLibrary(libraryName, libraryLink);
				libraryResultElement.text("Remove " + libraryName + " from Available Goodreads");
			} else {
				// hardway, go look up the dns record for the link
				libraryResultElement.text("Looking up URL for " + libraryName + "...");
				libraryResultElement.css("background-image", "url('" + chrome.extension.getURL('icons/throbber.gif') + "')");
				libraryResultElement.addClass("AGloading");

				// send a message for the background page to make the request
				chrome.runtime.sendMessage({
					type: "FROM_AGLIB_PAGE",
					libraryName: libraryName,
					libraryLink: libraryLink
				});
			}
		}
	}
}

// when an AG link is clicked
function onLibraryClick(libraryName, websiteSelector) {
	return function() {
		chrome.storage.sync.get("libraries", setOverdriveURL($(this), libraryName, websiteSelector));
		return false;
	}
}

// add an AG link to a library result or map pin
function insertAddLink(libraryResultSelector, libraryNameSelector, websiteSelector) {
	// check for the element and add our place holder before it
	$(libraryResultSelector + ":not(.AGadded)").each(function() {
		libraryResultElement = $(this);
		libraryResultElement.addClass('AGadded');
		// add the place holder
		libraryResultElement.after('<a href="#" class="AGadded library-label__save AGselect" style="background-color: #a39173;">Add this library to Available Goodreads</a>');;

		libraryNameElement = libraryResultElement.parent().find(libraryNameSelector);
		libraryNameElement.addClass('AGtitle');

		libraryName = libraryNameElement.text().replace(/[^ -~]+/g, "").replace(/^\s+|\s+$/g, '');

		// add a handler for click on the AG link
		libraryResultElement.parent().on('click', 'a.AGselect', onLibraryClick(libraryName, websiteSelector));

		updateLinkText();
	});
}


$(document).ready(function() {
	$("body").prepend("\
					<style>\
						a.AGselect { \
						background-image: url('" + chrome.extension.getURL('icons/icon48.png') + "');\
						background-size:30px;\
						background-repeat: no-repeat;\
						background-position: 10px center;\
						padding-left:40px !important;\
						display: block;\
						float:left;\
					}\
				</style>");

	// every second check to update the text if the library has been added/removed elsewhere
	//   this is done in case the user adds/removes a library from another tab
	textUpdateCheckInterval = setInterval(function() {
		updateLinkText();
	}, 1000);

	// rather than add hooks into the map data, map pins, and onclick on map pins,
	//   just check for the appeance of a map pin window
	mapUpdateCheckInterval = setInterval(function() {
		// check the elements in the search result list
		insertAddLink("h4.library-system__title", "h4.library-system__title", "a.btn.btn--small.btn--ext.add-library");
		// check for a map pin element
		insertAddLink("a.library-label__save", "h3.library-label__title", "a.library-label__save:not(.AGselect)");
	}, 200);
});


// listen for search results from background page
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	libraryResultElement = $("a.AGloading");
	libraryResultElement.removeClass("AGloading");
	libraryResultElement.css("background-image", "url('" + chrome.extension.getURL('icons/icon48.png') + "')");
	if (message.libraryName == "NOTFOUND") {
		alert("Error: A \".lib.overdrive.com\" URL could not be found for this library. Please read the Available Goodreads options page on how to manually add the URL.");
		libraryResultElement.text("Error adding this library to Available Goodreads");
	} else {
		addLibrary(message.libraryName, message.libraryLink);
		libraryResultElement.text("Remove " + message.libraryName + " from Available Goodreads");
	}
});

// parseUri 1.2.2
// (c) Steven Levithan <stevenlevithan.com>
// MIT License
function parseUri(str) {
	var o = parseUri.options,
		m = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
		uri = {},
		i = 14;

	while (i--) uri[o.key[i]] = m[i] || "";

	uri[o.q.name] = {};
	uri[o.key[12]].replace(o.q.parser, function($0, $1, $2) {
		if ($1) uri[o.q.name][$1] = $2;
	});

	return uri;
};
parseUri.options = {
	strictMode: false,
	key: ["source", "protocol", "authority", "userInfo", "user", "password", "host", "port", "relative", "path", "directory", "file", "query", "anchor"],
	q: {
		name: "queryKey",
		parser: /(?:^|&)([^&=]*)=?([^&]*)/g
	},
	parser: {
		strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
		loose: /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
	}
};