/**
 *
 * Copyright (C) 2013 sonicmoov co.,ltd. All rights reserved.
 *
 */

// debugger always enabled
Preferences.debuggerAlwaysEnabled = true;
// enable LiveEdit
Preferences.canEditScriptSource = true;
// enable heap profiler
Preferences.heapProfilerPresent = true;

WebInspector._createPanels = function()
{
    this.panels.scripts = new WebInspector.ScriptsPanel();
    this.panels.profiles = new WebInspector.ProfilesPanel();
    //this.panels.timeline = new WebInspector.TimelinePanel();
    //this.panels.elements = new WebInspector.ElementsPanel();
    //this.panels.network = new WebInspector.NetworkPanel();
    //this.panels.audits = new WebInspector.AuditsPanel();
    this.panels.console = new WebInspector.ConsolePanel();
    //this.panels.resources = new WebInspector.ResourcesPanel();
};

WebInspector.loaded = function()
{
    InspectorBackend.dumpInspectorProtocolMessages = true;
    //InspectorBackend.dumpInspectorTimeStats=true;

    var host = "192.168.2.2";//
    var port = 8081;
    if ("host" in WebInspector.queryParamsObject) host = WebInspector.queryParamsObject.host;
    if ("port" in WebInspector.queryParamsObject) port = parseInt( WebInspector.queryParamsObject.port );

    WebInspector.socket = new NativeJSAgentSocket( host, port );//{};//new WebSocket(ws);
    WebInspector.socket.onmessage = function(e) {
        InspectorBackend.dispatch( e.data );
    }
    WebInspector.socket.onerror = function(error) { console.error(error); }
    WebInspector.socket.onopen = function() {
        InspectorFrontendHost.sendMessageToBackend = WebInspector.socket.send.bind(WebInspector.socket);
        //InspectorFrontendHost.loaded = WebInspector.socket.send.bind(WebInspector.socket, "loaded");
        WebInspector.doLoadedDone();
    }
    WebInspector.socket.onclose = function() {
        /*
        if (!WebInspector.socket._detachReason)
            (new WebInspector.RemoteDebuggingTerminatedScreen("websocket_closed")).showModal();
            */
    }

    var v8 = new V8Wrapper( WebInspector.socket.webSocket );
    DebuggerAgent = DebuggerAgentCreate( {
        njsSock: WebInspector.socket,
        v8: v8
    } );

    RuntimeAgent = RuntimeAgentCreate( {
        njsSock: WebInspector.socket,
        v8: v8
    } );

    ConsoleAgent = ConsoleAgentCreate( {
        njsSock: WebInspector.socket,
        v8: v8
    } );
};


WebInspector.doLoadedDone = function()
{
    InspectorFrontendHost.loaded();

    var platform = WebInspector.platform;
    document.body.addStyleClass("platform-" + platform);
    var flavor = WebInspector.platformFlavor;
    if (flavor)
        document.body.addStyleClass("platform-" + flavor);
    var port = WebInspector.port;
    document.body.addStyleClass("port-" + port);
    if (WebInspector.socket)
        document.body.addStyleClass("remote");

    WebInspector.settings = new WebInspector.Settings();

    this._registerShortcuts();

    // set order of some sections explicitly
    WebInspector.shortcutsHelp.section(WebInspector.UIString("Console"));
    WebInspector.shortcutsHelp.section(WebInspector.UIString("Elements Panel"));

    this.drawer = new WebInspector.Drawer();
    this.console = new WebInspector.ConsoleView(this.drawer);
    this.drawer.visibleView = this.console;
    //this.networkManager = new WebInspector.NetworkManager();
    //this.resourceTreeModel = new WebInspector.ResourceTreeModel();
    //this.domAgent = new WebInspector.DOMAgent();

    InspectorBackend.registerDomainDispatcher("Inspector", this);
    InspectorBackend.registerDomainDispatcher("Page", this);

    this.resourceCategories = {
        //documents: new WebInspector.ResourceCategory("documents", WebInspector.UIString("Documents"), "rgb(47,102,236)"),
        //stylesheets: new WebInspector.ResourceCategory("stylesheets", WebInspector.UIString("Stylesheets"), "rgb(157,231,119)"),
        images: new WebInspector.ResourceCategory("images", WebInspector.UIString("Images"), "rgb(164,60,255)"),
        scripts: new WebInspector.ResourceCategory("scripts", WebInspector.UIString("Scripts"), "rgb(255,121,0)"),
        xhr: new WebInspector.ResourceCategory("xhr", WebInspector.UIString("XHR"), "rgb(231,231,10)"),
        //fonts: new WebInspector.ResourceCategory("fonts", WebInspector.UIString("Fonts"), "rgb(255,82,62)"),
        websockets: new WebInspector.ResourceCategory("websockets", WebInspector.UIString("WebSockets"), "rgb(186,186,186)"), // FIXME: Decide the color.
        other: new WebInspector.ResourceCategory("other", WebInspector.UIString("Other"), "rgb(186,186,186)")
    };

    //this.cssModel = new WebInspector.CSSStyleModel();
    this.debuggerModel = new WebInspector.DebuggerModel();

    this.searchController = new WebInspector.SearchController();
    this.domBreakpointsSidebarPane = new WebInspector.DOMBreakpointsSidebarPane();

    this.panels = {};
    this._createPanels();
    this._panelHistory = new WebInspector.PanelHistory();
    this.toolbar = new WebInspector.Toolbar();

    this.panelOrder = [];
    for (var panelName in this.panels)
        this.addPanel(this.panels[panelName]);

    this.Tips = {
        ResourceNotCompressed: {id: 0, message: WebInspector.UIString("You could save bandwidth by having your web server compress this transfer with gzip or zlib.")}
    };

    this.Warnings = {
        IncorrectMIMEType: {id: 0, message: WebInspector.UIString("Resource interpreted as %s but transferred with MIME type %s.")}
    };

    this.addMainEventListeners(document);

    window.addEventListener("resize", this.windowResize.bind(this), true);

    document.addEventListener("focus", this.focusChanged.bind(this), true);
    document.addEventListener("keydown", this.documentKeyDown.bind(this), false);
    document.addEventListener("beforecopy", this.documentCanCopy.bind(this), true);
    document.addEventListener("copy", this.documentCopy.bind(this), true);
    document.addEventListener("contextmenu", this.contextMenuEventFired.bind(this), true);

    var dockToggleButton = document.getElementById("dock-status-bar-item");
    dockToggleButton.addEventListener("click", this.toggleAttach.bind(this), false);

    if (this.attached)
        dockToggleButton.title = WebInspector.UIString("Undock into separate window.");
    else
        dockToggleButton.title = WebInspector.UIString("Dock to main window.");

    var errorWarningCount = document.getElementById("error-warning-count");
    errorWarningCount.addEventListener("click", this.showConsole.bind(this), false);
    this._updateErrorAndWarningCounts();

    this.extensionServer.initExtensions();

    if (WebInspector.settings.monitoringXHREnabled)
        ConsoleAgent.setMonitoringXHREnabled(true);

    ConsoleAgent.enable( this.console.setConsoleMessageExpiredCount.bind(this.console) );

    //DatabaseAgent.enable();

    WebInspector.showPanel(WebInspector.settings.lastActivePanel);

    /*
    function propertyNamesCallback(error, names) {
        if (!error) WebInspector.cssNameCompletions = new WebInspector.CSSCompletions(names);
    }
    // As a DOMAgent method, this needs to happen after the frontend has loaded and the agent is available.
    CSSAgent.getSupportedCSSProperties(propertyNamesCallback);
    */
}


WebInspector.resourceForURL = function(url) {
    return null;//new WebInspector.Resource( url, url );
};


InspectorBackend.registerCallbackAndIssueId = function( method, callback ) {
    var messageObject = {};
    messageObject.method = method;
    //if (params) messageObject.params = params;
    messageObject.id = this._wrap(callback, method);

    if (this.dumpInspectorProtocolMessages)
        console.log("frontend: " + JSON.stringify(messageObject));

    ++this._pendingResponsesCount;

    // TODO messageObject?

    return messageObject.id;
};