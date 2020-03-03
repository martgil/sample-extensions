/* eslint-disable object-shorthand */

// Get various parts of the WebExtension framework that we need.
var { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");

// You probably already know what this does.
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

// ChromeUtils.import() works in experiments for core resource urls as it did
// in legacy add-ons. However, chrome:// urls that point to add-on resources no
// longer work, as the "chrome.manifest" file is no longer supported, which
// defined the root path for each add-on. Instead, ChromeUtils.import() needs
// a mozExtension:// url, which can access any resource in an add-on:
//
// mozExtension://<Add-On-UUID>/path/to/modue.jsm
//
// The add-on UUID is a random identifier generated on install for each add-on.
// The extension object of the WebExtension has a getURL() method, to get the
// required url:
//
// let mozExtensionUrl = extension.getURL("path/to/modue.jsm");
//
// You can get the extension object from the context parameter passed to
// getAPI() of the WebExtension experiment implementation:
//
// let extension = context.extension;
//
// or you can generate the extension object from a given add-on ID as shown in
// the example below. This allows to import JSM out of context, for example
// inside another JSM. 
//
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
let extension = ExtensionParent.GlobalManager.getExtension("experiment@sample.extensions.thunderbird.net");
var { myModule } = ChromeUtils.import(extension.getURL("modules/myModule.jsm"));

// This is the important part. It implements the functions and events defined in schema.json.
// The variable must have the same name you've been using so far, "myapi" in this case.
var myapi = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    return {
      // Again, this key must have the same name.
      myapi: {

        // A function.
        sayHello: async function(name) {
          myModule.incValue();
          Services.wm.getMostRecentWindow("mail:3pane").alert("Hello " + name + "! I counted <" + myModule.getValue() + "> clicks so far.");
        },

        // An event. Most of this is boilerplate you don't need to worry about, just copy it.
        onToolbarClick: new ExtensionCommon.EventManager({
          context,
          name: "myapi.onToolbarClick",
          // In this function we add listeners for any events we want to listen to, and return a
          // function that removes those listeners. To have the event fire in your extension,
          // call fire.async.
          register(fire) {
            function callback(event, id, x, y) {
              return fire.async(id, x, y);
            }

            windowListener.add(callback);
            return function() {
              windowListener.remove(callback);
            };
          },
        }).api(),

      },
    };
  }
};

// A helpful class for listening to windows opening and closing.
// (This file had a lowercase E in Thunderbird 65 and earlier.)
var { ExtensionSupport } = ChromeUtils.import("resource:///modules/ExtensionSupport.jsm");

// This object is just what we're using to listen for toolbar clicks. The implementation isn't
// what this example is about, but you might be interested as it's a common pattern. We count the
// number of callbacks waiting for events so that we're only listening if we need to be.
var windowListener = new class extends ExtensionCommon.EventEmitter {
  constructor() {
    super();
    this.callbackCount = 0;
  }

  handleEvent(event) {
    let toolbar = event.target.closest("toolbar");
    windowListener.emit("toolbar-clicked", toolbar.id, event.clientX, event.clientY);
  }

  add(callback) {
    this.on("toolbar-clicked", callback);
    this.callbackCount++;

    if (this.callbackCount == 1) {
      ExtensionSupport.registerWindowListener("experimentListener", {
        chromeURLs: [
          "chrome://messenger/content/messenger.xhtml",
          "chrome://messenger/content/messenger.xul",
        ],
        onLoadWindow: function(window) {
          let toolbox = window.document.getElementById("mail-toolbox");
          toolbox.addEventListener("click", windowListener.handleEvent);
        },
      });
    }
  }

  remove(callback) {
    this.off("toolbar-clicked", callback);
    this.callbackCount--;

    if (this.callbackCount == 0) {
      for (let window of ExtensionSupport.openWindows) {
        if ([
          "chrome://messenger/content/messenger.xhtml",
          "chrome://messenger/content/messenger.xul",
        ].includes(window.location.href)) {
          let toolbox = window.document.getElementById("mail-toolbox");
          toolbox.removeEventListener("click", this.handleEvent);
        }
      }
      ExtensionSupport.unregisterWindowListener("experimentListener");
    }
  }
};
