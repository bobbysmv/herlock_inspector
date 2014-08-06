(function() {
  var helpers = new function() {
    this.isArray = function(obj) {
      return obj instanceof Array
    };
    this.isRegExp = function(obj) {
      return obj instanceof RegExp
    };
    this.isDate = function(obj) {
      return obj instanceof Date
    };
    this.isUndefined = function(obj) {
      return obj === undefined
    };
    this.isObject = function(obj) {
      return obj instanceof Object
    }
  };
  var primitiveTypes = {undefined:true, "boolean":true, number:true, string:true};
  var isPrimitiveValue = function(object) {
    return primitiveTypes[typeof object]
  };
  helpers.isPrimitiveValue = isPrimitiveValue;
  var subtype = function(obj) {
    if(obj === null) {
      return"null"
    }
    var type = typeof obj;
    if(helpers.isPrimitiveValue(obj)) {
      return null
    }
    if(helpers.isArray(obj)) {
      return"array"
    }
    if(helpers.isRegExp(obj)) {
      return"regexp"
    }
    if(helpers.isDate(obj)) {
      return"date"
    }
    try {
      if(Object.prototype.toString.call(obj) === "[object Arguments]" && isFinite(obj.length)) {
        return"array"
      }
    }catch(e) {
    }
    return null
  };
  helpers.subtype = subtype;
  var describe = function(obj) {
    if(helpers.isPrimitiveValue(obj)) {
      return null
    }
    var subtype = helpers.subtype(obj);
    if(subtype === "regexp") {
      return"" + obj
    }
    if(subtype === "date") {
      return"" + obj
    }
    if(subtype === "array") {
      var className = "array ";
      if(typeof obj.length === "number") {
        className += "[" + obj.length + "]"
      }
      return className
    }
    if(typeof obj === "function") {
      return"" + obj
    }
    if(helpers.isObject(obj)) {
      var constructorName = obj.constructor && obj.constructor.name;
      if(constructorName) {
        return constructorName
      }
    }
    return"" + obj
  };
  var decycle = function(object) {
    var objects = [], paths = [];
    return function derez(value, path) {
      var i, name, nu;
      switch(typeof value) {
        case "object":
          if(!value) {
            return null
          }
          for(i = 0;i < objects.length;i += 1) {
            if(objects[i] === value) {
              return{$ref:paths[i]}
            }
          }
          objects.push(value);
          paths.push(path);
          if(Object.prototype.toString.apply(value) === "[object Array]") {
            nu = [];
            for(i = 0;i < value.length;i += 1) {
              nu[i] = derez(value[i], path + "[" + i + "]")
            }
          }else {
            nu = {};
            for(name in value) {
              if(Object.prototype.hasOwnProperty.call(value, name)) {
                nu[name] = derez(value[name], path + "[" + JSON.stringify(name) + "]")
              }
            }
          }
          return nu;
        case "number":
        ;
        case "string":
        ;
        case "boolean":
          return value
      }
    }(object, "$")
  };
  decycle = function(object) {
    var objects = [];
    var paths = [];
    function derez(value, path, nonspread) {
      var i, name, nu;
      switch(typeof value) {
        case "object":
          if(!value) {
            return null
          }
          for(i = 0;i < objects.length;i += 1) {
            if(objects[i] === value) {
              return{$ref:paths[i]}
            }
          }
          objects.push(value);
          paths.push(path);
          if(nonspread) {
            return{}
          }
          if(Object.prototype.toString.apply(value) === "[object Array]") {
            nu = [];
            for(i = 0;i < value.length;i += 1) {
              nu[i] = derez(value[i], path + "[" + i + "]", true)
            }
          }else {
            nu = {};
            for(name in value) {
              if(Object.prototype.hasOwnProperty.call(value, name)) {
                nu[name] = derez(value[name], path + "[" + JSON.stringify(name) + "]", true)
              }
            }
          }
          return nu;
        case "number":
        ;
        case "string":
        ;
        case "boolean":
          return value
      }
    }
    return derez(object, "$")
  };
  helpers.decycle = decycle;
  helpers.describe = describe;
  devtools.inspector.helpers = helpers
})();
(function() {
  var inspector = devtools.inspector;
  inspector.start();
  var Loader = function() {
    var len = arguments.length, c = 0, self = this;
    this.cnt = function() {
      c++;
      if(c >= len) {
        this.onload()
      }
    };
    for(var i = 0;i < len;i++) {
      (new Script(arguments[i])).onload = function() {
        self.cnt()
      }
    }
  };
  console.log("local!!");
  function notify(notification, flg) {
    var msg = JSON.stringify(notification);
    app.nativeLog("inspector.send notify " + (notification.method ? notification.method : ""));
    inspector.send(msg)
  }
  location.onreload = function() {
    notify({method:"Inspector.reload", params:{}})
  };
  var v8Client = null;
  var agents = {};
  function getAgent(key) {
    var name = key + "Agent";
    if(!agents[name] && devtools.inspector[name]) {
      agents[name] = new devtools.inspector[name](notify, v8Client)
    }
    if(!agents[name] && window[name]) {
      agents[name] = new window[name](notify, v8Client)
    }
    if(!agents[name]) {
      console.log(name + " is not found!")
    }
    return agents[name]
  }
  inspector.getAgent = getAgent;
  inspector.onMessage = function(message) {
    app.nativeLog("inspector.onMessage");
    var data;
    try {
      app.nativeLog("inspector.onMessage JSON.parse");
      data = JSON.parse(message)
    }catch(e) {
      console.log(e)
    }
    var key = data.method.split(".")[0];
    var method = data.method.split(".")[1];
    var id = data.id;
    var params = data.params;
    var agent = getAgent(key);
    if(!agent[method]) {
      console.log(data.method + " is not found!")
    }
    agent[method](params, function(result) {
      var msg = JSON.stringify({id:id, result:result});
      app.nativeLog("inspector.send " + method + "id:" + id);
      inspector.send(msg)
    })
  }
})();
(function() {
  var inspector = devtools.inspector;
  function formatedString() {
    var r = "";
    var len = arguments.length;
    for(var i = 0;i < len;i++) {
      r += ", " + arguments[i]
    }
    return r.substr(2)
  }
  function ConsoleAgent(notify) {
    this.notify = notify;
    this.enabled = false;
    this.messages = [];
    var self = this;
    var nativeConsole = console;
    var nativeConsoleMethods = {"log":console.log, "warn":console.warn, "info":console.info, "error":console.error, "dir":console.dir};
    ["log", "warn", "info", "error", "dir"].forEach(function(level) {
      var ref = nativeConsoleMethods[level];
      if(!ref) {
        return
      }
      console[level] = function() {
        ref.apply(nativeConsole, arguments);
        var message = {method:"Console.messageAdded", params:{message:{text:formatedString.apply(self, arguments), level:level == "warn" ? "warning" : level, source:"javascript"}}};
        self.messages.push(message);
        notify(message, false)
      }
    });
    var nativeOnUncaughtError = window.onUncaughtError;
    window.onUncaughtError = function(err) {
      if(nativeOnUncaughtError) {
        nativeOnUncaughtError.apply(window, arguments)
      }
      var message = null;
      if(app.isANDROID) {
        message = {method:"Console.messageAdded", params:{message:{type:"uncaughtException", text:err.message, level:"error", line:null, source:"javascript", stackTrace:err.__stacktrace}}}
      }
      if(app.isIOS) {
        message = {method:"Console.messageAdded", params:{message:{type:"uncaughtException", text:err.message, level:"error", line:err.line, source:"javascript", stackTrace:[{lineNumber:err.line, columnNumber:null, url:err.sourceURL, functionName:null}]}}}
      }
      self.messages.push(message);
      notify(message, false)
    };
    this.objects = {}
  }
  (function() {
    this.enable = function(params, sendResult) {
      this.enabled = true;
      sendResult({result:this.enabled});
      for(var i = 0, len = this.messages.length;i < len;i++) {
        this.notify(this.messages[i])
      }
    };
    this.disable = function(params, sendResult) {
      this.enabled = false;
      sendResult({})
    };
    this.clearConsoleMessages = function(params, sendResult) {
      console.log("Console.clearConsoleMessages");
      this.messages = [];
      sendResult({});
      this.notify({method:"Console.messagesCleared"}, false)
    };
    this.evaluate = function(params, sendResult) {
      inspector.getAgent("Runtime").evaluate(params, sendResult)
    };
    this.getProperties = function(params, sendResult) {
      inspector.getAgent("Runtime").getProperties(params, sendResult)
    };
    this.setPropertyValue = function(params, sendResult) {
      inspector.getAgent("Runtime").setPropertyValue(params, sendResult)
    };
    this.evaluateOn = function(params, sendResult) {
      inspector.getAgent("Runtime").evaluateOn(params, sendResult)
    }
  }).call(ConsoleAgent.prototype);
  devtools.inspector.ConsoleAgent = ConsoleAgent
})();
(function() {
  var inspector = devtools.inspector;
  Node = {ELEMENT_NODE:1, DOCUMENT_NODE:9, ATTRIBUTE_NODE:2};
  function DOMAgent(notify) {
    this.notify = notify;
    this.enabled = false;
    this.highlightObject = null
  }
  (function() {
    this.enable = function(params, sendResult) {
      this.enabled = true;
      sendResult({result:this.enabled})
    };
    this.disable = function(params, sendResult) {
      this.enabled = false;
      sendResult({})
    };
    this.getDocument = function(params, sendResult) {
      app.nativeLog("DOMAgent.getDocument");
      sendResult({root:windowToNode()})
    };
    this.resolveNode = function(params, sendResult) {
      var remoteObject = inspector.getAgent("Runtime").getRemoteObjectById(params.nodeId);
      sendResult({object:remoteObject || {}})
    };
    this.highlightDOMNode = function(params, sendResult) {
      if(this.highlightObject) {
        var object = this.highlightObject;
        if(object.transform && object.transform.colorTransform) {
          object.transform.colorTransform = object.__ct_backup
        }
        this.highlightObject = null
      }
      this.highlightObject = inspector.getAgent("Runtime").getObjectByRemoteId(params.nodeId);
      var object = this.highlightObject;
      if(object.transform && object.transform.colorTransform) {
        object.__ct_backup = object.transform.colorTransform;
        var newCt = new ColorTransform(1.4, 1.4, 1, 0.7, 20, 20);
        newCt.concat(object.transform.colorTransform);
        object.transform.colorTransform = newCt
      }
      sendResult({})
    };
    this.getEventListenersForNode = function(params, sendResult) {
      params.nodeId;
      var listener = {nodeId:nodeId, type:type, listenerBody:listenerBody, sourceName:sourceName, lineNumber:lineNumber};
      sendResult({listeners:[]})
    }
  }).call(DOMAgent.prototype);
  devtools.inspector.DOMAgent = DOMAgent;
  function windowToNode() {
    app.nativeLog("windowToNode");
    var layers = [];
    var i = 0;
    while(getLayerAt(i)) {
      layers.push(getLayerAt(i).toNode());
      i++
    }
    var remote = inspector.getAgent("Runtime").wrapObject(window, "DOM");
    var node = {id:remote.objectId, nodeType:Node.ELEMENT_NODE, nodeName:"Window", localName:"Window", nodeValue:"", attributes:[], childNodeCount:layers.length, children:layers, documentURL:location.href};
    return{id:"", nodeType:Node.DOCUMENT_NODE, nodeName:"Window", localName:"Window", nodeValue:"", attributes:[], childNodeCount:1, children:[node], documentURL:location.href}
  }
  Layer.prototype.toNode = function() {
    app.nativeLog("Layer.prototype.toNode");
    var remote = inspector.getAgent("Runtime").wrapObject(this, "DOM");
    return{id:remote.objectId, nodeType:Node.ELEMENT_NODE, nodeName:"Layer", localName:"Layer", nodeValue:"", attributes:[], childNodeCount:this.content ? 1 : 0, children:this.content && this.content.toNode ? [this.content.toNode()] : []}
  };
  Image.prototype.toNode = function() {
    var remote = inspector.getAgent("Runtime").wrapObject(this, "DOM");
    return{id:remote.objectId, nodeType:Node.ELEMENT_NODE, nodeName:"Image", localName:"Image", nodeValue:"", attributes:this.src ? ["src", this.src] : [], childNodeCount:0, children:[]}
  };
  DisplayObject.prototype.toNode = function() {
    app.nativeLog("DisplayObject.prototype.toNode");
    var remote = inspector.getAgent("Runtime").wrapObject(this, "DOM");
    app.nativeLog("DisplayObject.prototype.toNode wrapObject");
    return{id:remote.objectId, nodeType:Node.ELEMENT_NODE, nodeName:"DisplayObject", localName:"DisplayObject", nodeValue:"", attributes:this.name ? ["name", this.name] : [], childNodeCount:0, children:[]}
  };
  Bitmap.prototype.toNode = function() {
    app.nativeLog("Bitmap.prototype.toNode");
    var node = DisplayObject.prototype.toNode.call(this);
    node.nodeName = node.localName = "Bitmap";
    node.childNodeCount = this.bitmapData ? 1 : 0;
    node.children = this.bitmapData ? [this.bitmapData.toNode()] : [];
    return node
  };
  BitmapData.prototype.toNode = function() {
    app.nativeLog("BitmapData.prototype.toNode");
    var remote = inspector.getAgent("Runtime").wrapObject(this, "DOM");
    return{id:remote.objectId, nodeType:Node.ELEMENT_NODE, nodeName:"BitmapData", localName:"BitmapData", nodeValue:"", attributes:["width", "" + this.width, "height", "" + this.height], childNodeCount:0, children:[]}
  };
  TextField.prototype.toNode = function() {
    app.nativeLog("TextField.prototype.toNode");
    var node = DisplayObject.prototype.toNode.call(this);
    node.nodeName = node.localName = "TextField";
    node.nodeValue = this.text;
    node.attributes.push("text", this.text);
    return node
  };
  DisplayObjectContainer.prototype.toNode = function() {
    app.nativeLog("DisplayObjectContainer.prototype.toNode");
    var node = DisplayObject.prototype.toNode.call(this);
    node.nodeName = node.localName = "DisplayObjectContainer";
    var children = [];
    var i = 0, len = this.numChildren;
    for(i;i < len;i++) {
      children.push(this.getChildAt(i).toNode())
    }
    node.childNodeCount = len;
    node.children = children;
    return node
  };
  Stage.prototype.toNode = function() {
    app.nativeLog("Stage.prototype.toNode");
    var node = DisplayObjectContainer.prototype.toNode.call(this);
    node.nodeName = node.localName = "Stage";
    node.attributes.push("frameRate", "" + this.frameRate);
    return node
  };
  Sprite.prototype.toNode = function() {
    app.nativeLog("Sprite.prototype.toNode");
    var node = DisplayObjectContainer.prototype.toNode.call(this);
    node.nodeName = node.localName = "Sprite";
    return node
  };
  TinyGL.prototype.toNode = function() {
    app.nativeLog("TinyGL.prototype.toNode");
    var remote = inspector.getAgent("Runtime").wrapObject(this, "DOM");
    return{id:remote.objectId, nodeType:Node.ELEMENT_NODE, nodeName:"TinyGL", localName:"TinyGL", nodeValue:"", attributes:[], childNodeCount:0, children:[]}
  }
})();
(function() {
  function DOMStorageAgent(notify) {
    this.notify = notify;
    this._enabled = false;
    this.storages = []
  }
  (function() {
    this.notifyAddDOMStorage = function(storage) {
      this.notify({method:"DOMStorage.addDOMStorage", params:{storage:storage}})
    };
    this.notifyUpdateDOMStorage = function(storageId) {
      this.notify({method:"DOMStorage.updateDOMStorage", params:{storageId:storageId}})
    };
    this.enable = function(params, sendResult) {
      this._enabled = true;
      sendResult({result:this._enabled});
      if(!this._enabled) {
        return
      }
      this.storages.push(localStorage);
      this.notifyAddDOMStorage({id:this.storages.indexOf(localStorage), host:location.host, isLocalStorage:true})
    };
    this.disable = function(params, sendResult) {
    };
    this.getDOMStorageEntries = function(params, sendResult) {
      var storage = this.storages[params.storageId];
      var entries = [];
      var len = storage.length;
      for(var i = 0;i < len;i++) {
        var k = storage.key(i);
        var v = storage.getItem(k);
        entries.push([k, v])
      }
      sendResult({entries:entries})
    };
    this.setDOMStorageItem = function(params, sendResult) {
      var storage = this.storages[params.storageId];
      try {
        storage.setItem(params.key, params.value)
      }catch(e) {
        sendResult({success:false});
        return
      }
      sendResult({success:true})
    };
    this.removeDOMStorageItem = function(params, sendResult) {
      var storage = this.storages[params.storageId];
      try {
        storage.removeItem(params.key)
      }catch(e) {
        sendResult({success:false});
        return
      }
      sendResult({success:true})
    }
  }).call(DOMStorageAgent.prototype);
  devtools.inspector.DOMStorageAgent = DOMStorageAgent
})();
(function() {
  function DebuggerAgent(notify) {
    this.notify = notify;
    this._enabled = false
  }
  (function() {
    this.enable = function(params, sendResult) {
      this._enabled = app.isANDROID ? true : false;
      sendResult({result:this._enabled});
      if(!this._enabled) {
        return
      }
    };
    this.disable = function(params, sendResult) {
    }
  }).call(DebuggerAgent.prototype);
  devtools.inspector.DebuggerAgent = DebuggerAgent
})();
(function() {
  function InspectorAgent() {
    this.enabled = false
  }
  InspectorAgent.prototype.enable = function(params, sendResult) {
    this.enabled = true;
    sendResult({result:this.enabled})
  };
  InspectorAgent.prototype.disable = function(params, sendResult) {
    this.enabled = false;
    sendResult({result:this.enabled})
  };
  devtools.inspector.InspectorAgent = InspectorAgent
})();
(function() {
  function PageAgent() {
    this.enabled = false
  }
  (function() {
    this.enable = function(params, sendResult) {
      sendResult({result:this.enabled})
    };
    this.canOverrideDeviceMetrics = function(params, sendResult) {
      sendResult({result:false})
    };
    this.canShowDebugBorders = function(params, sendResult) {
      sendResult({result:false})
    };
    this.canShowFPSCounter = function(params, sendResult) {
      sendResult({result:false})
    };
    this.canContinuouslyPaint = function(params, sendResult) {
      sendResult({result:false})
    };
    this.canOverrideGeolocation = function(params, sendResult) {
      sendResult({result:false})
    };
    this.canOverrideDeviceOrientation = function(params, sendResult) {
      sendResult({result:false})
    };
    this.setTouchEmulationEnabled = function(params, sendResult) {
      sendResult({result:false})
    }
  }).call(PageAgent.prototype);
  devtools.inspector.PageAgent = PageAgent
})();
(function() {
  var HeapProfileType = "HEAP";
  var CPUProfileType = "CPU";
  function ProfilerAgent(notify) {
    this.notify = notify;
    this.profiles = {HEAP:{}, CPU:{}};
    this.enabled = false;
    this.isProfilingCPU = false
  }
  (function() {
    var inspector = devtools.inspector;
    this.enable = function(params, sendResult) {
      this.enabled = app.isANDROID ? true : false;
      sendResult({result:this.enabled});
      if(!this.enabled) {
        return
      }
      this.notify({method:"Profiler.profilerWasEnabled", params:{}})
    };
    this.causesRecompilation = function(params, sendResult) {
      sendResult({result:false})
    };
    this.isSampling = function(params, sendResult) {
      sendResult({result:this.isProfilingCPU})
    };
    this.hasHeapProfiler = function(params, sendResult) {
      sendResult({result:true})
    };
    this.getProfileHeaders = function(params, sendResult) {
      var headers = [];
      for(var type in this.profiles) {
        for(var profileId in this.profiles[type]) {
          var profile = this.profiles[type][profileId];
          headers.push({title:profile.title, uid:profile.uid, typeId:type})
        }
      }
      sendResult({headers:headers})
    };
    this.snapshotCnt = 0;
    this.takeHeapSnapshot = function(params, sendResult) {
      var self = this;
      var snapshot = inspector.v8debugger.takeSnapshot("njs_snapshot_" + this.snapshotCnt++);
      this.profiles[HeapProfileType][snapshot.uid] = snapshot;
      this.notify({method:"Profiler.addProfileHeader", params:{header:{title:snapshot.title, uid:snapshot.uid, typeId:HeapProfileType}}});
      sendResult({})
    };
    this.getHeapSnapshot = function(params, sendResult) {
      var self = this;
      var snapshot = this.profiles[HeapProfileType][params.uid];
      snapshot.serialize(function onData(chunk, size) {
        chunk = chunk + "";
        self.notify({method:"Profiler.addHeapSnapshotChunk", params:{uid:snapshot.uid, chunk:chunk}})
      }, function onEnd() {
        self.notify({method:"Profiler.finishHeapSnapshot", params:{uid:snapshot.uid}});
        sendResult({profile:{title:snapshot.title, uid:snapshot.uid, typeId:HeapProfileType}})
      })
    };
    this.getCPUProfile = function(params, sendResult) {
      var self = this;
      var profile = this.profiles[CPUProfileType][params.uid];
      profile.typeId = CPUProfileType;
      sendResult({profile:{title:profile.title, uid:profile.uid, typeId:CPUProfileType, head:profile.getTopDownRoot(), bottomUpHead:profile.getBottomUpRoot()}})
    };
    this.getProfile = function(params, sendResult) {
      if(params.type === HeapProfileType) {
        this.getHeapSnapshot(params, sendResult)
      }else {
        if(params.type === CPUProfileType) {
          this.getCPUProfile(params, sendResult)
        }
      }
    };
    this.clearProfiles = function(params, sendResult) {
      this.profiles.HEAP = {};
      this.profiles.CPU = {};
      inspector.v8debugger.deleteAllSnapshots();
      inspector.v8debugger.deleteAllProfiles()
    };
    this.currentProfileName = null;
    this.profileCnt = 0;
    this.start = function(params, sendResult) {
      if(this.currentProfileName !== null) {
        throw new Error("profiling... " + this.currentProfileName);
      }
      this.currentProfileName = "njs_profile_" + this.profileCnt++;
      inspector.v8debugger.startProfiling(this.currentProfileName);
      this.notify({method:"Profiler.setRecordingProfile", params:{isProfiling:true}});
      sendResult({})
    };
    this.stop = function(params, sendResult) {
      var profile = inspector.v8debugger.stopProfiling(this.currentProfileName);
      this.currentProfileName = null;
      this.profiles[CPUProfileType][profile.uid] = profile;
      this.notify({method:"Profiler.addProfileHeader", params:{header:{title:profile.title, uid:profile.uid, typeId:CPUProfileType}}});
      this.notify({method:"Profiler.setRecordingProfile", params:{isProfiling:false}});
      sendResult({})
    };
    this.collectGarbage = function(params, sendResult) {
      app.gc();
      sendResult({})
    }
  }).call(ProfilerAgent.prototype);
  devtools.inspector.ProfilerAgent = ProfilerAgent
})();
(function() {
  var helpers = devtools.inspector.helpers;
  var _objectId = 0;
  var RemoteObject = function(object, forceValueType) {
    this.type = typeof object;
    if(helpers.isPrimitiveValue(object) || object === null || forceValueType) {
      if(typeof object !== "undefined") {
        this.value = object
      }
      if(object === null) {
        this.subtype = "null"
      }
      if(typeof object === "number") {
        this.description = object + ""
      }
      if(typeof object === "string") {
        this.description = object
      }
      return
    }
    this.objectId = "console_" + JSON.stringify({injectedScriptId:0, id:_objectId++});
    var subtype = helpers.subtype(object);
    if(subtype) {
      this.subtype = subtype
    }
    this.className = object.constructor || object.name || "";
    this.description = helpers.describe(object);
    this.value = helpers.decycle(object)
  };
  devtools.inspector.RemoteObject = RemoteObject;
  var getPropertyDescriptors = function(object, ownProperties) {
    var descriptors = [];
    var nameProcessed = {};
    nameProcessed.__proto__ = null;
    for(var o = object;helpers.isObject(o);o = o.__proto__) {
      var names = Object.getOwnPropertyNames(o);
      for(var i = 0;i < names.length;++i) {
        var name = names[i];
        if(nameProcessed[name]) {
          continue
        }
        var descriptor = {};
        try {
          nameProcessed[name] = true;
          descriptor = Object.getOwnPropertyDescriptor(object, name);
          if(!descriptor) {
            try {
              descriptors.push({name:name, value:object[name], writable:false, configurable:false, enumerable:false})
            }catch(e) {
            }
            continue
          }
        }catch(e) {
          descriptor = {};
          descriptor.value = e;
          descriptor.wasThrown = true
        }
        descriptor.name = name;
        descriptors.push(descriptor)
      }
      if(ownProperties) {
        if(object.__proto__) {
          descriptors.push({name:"__proto__", value:object.__proto__, writable:true, configurable:true, enumerable:false})
        }
        break
      }
    }
    return descriptors
  };
  function RuntimeAgent(notify, v8Client) {
    this.notify = notify;
    this.objects = {}
  }
  RuntimeAgent.prototype.evaluate = function(params, sendResult) {
    var result = null;
    try {
      result = eval.call(global, "with ({}) {\n" + params.expression + "\n}")
    }catch(e) {
      e.stack = "";
      return sendResult(this.createThrownValue(e, params.objectGroup))
    }
    sendResult({result:this.wrapObject(result, params.objectGroup), wasThrown:false})
  };
  RuntimeAgent.prototype.evaluateOn = function(params, sendResult) {
    var result = null;
    try {
      result = eval.call(global, "( function() {" + params.expression + '} ).call( devtools.inspector.getAgent("Runtime").getObjectByRemoteId( "' + params.objectId + '") );')
    }catch(e) {
      e.stack = "";
      return sendResult(this.createThrownValue(e, params.objectGroup))
    }
    sendResult({result:this.wrapObject(result, params.objectGroup), wasThrown:false})
  };
  RuntimeAgent.prototype.setPropertyValue = function(params, sendResult) {
    var object = this.getObjectByRemoteId(params.objectId);
    if(object && params.name in object) {
      object[params.name] = params.value;
      eval.call(global, "( function() { this." + params.name + " = " + params.value + '; } ).call( devtools.inspector.getAgent("Runtime").getObjectByRemoteId( "' + params.objectId + '") );')
    }
    sendResult({result:true})
  };
  RuntimeAgent.prototype.getProperties = function(params, sendResult) {
    var object = this.objects[params.objectId];
    if(helpers.isUndefined(object)) {
      console.error("RuntimeAgent.getProperties: Unknown object");
      return
    }
    object = object.value;
    var descriptors = getPropertyDescriptors(object, params.ownProperties);
    var len = descriptors.length;
    if(len === 0 && "arguments" in object) {
      for(var key in object) {
        descriptors.push({name:key, value:object[key], writable:false, configurable:false, enumerable:true})
      }
    }
    for(var i = 0;i < len;++i) {
      var descriptor = descriptors[i];
      if("get" in descriptor) {
        descriptor.get = this.wrapObject(descriptor.get)
      }
      if("set" in descriptor) {
        descriptor.set = this.wrapObject(descriptor.set)
      }
      if("value" in descriptor) {
        descriptor.value = this.wrapObject(descriptor.value)
      }
      if("get" in descriptor && !descriptor.value) {
        descriptor.value = this.wrapObject(object[descriptor.name])
      }
      if(!("configurable" in descriptor)) {
        descriptor.configurable = false
      }
      if(!("enumerable" in descriptor)) {
        descriptor.enumerable = false
      }
    }
    var results = [];
    for(var i = 0;i < len;++i) {
      var desc = descriptors[i];
      if(desc.name === "_nativejs_private_holder") {
        continue
      }
      results.push({name:desc.name, value:{type:desc.value.type, description:desc.value.description || "" + desc.value.value, hasChildren:desc.value.value instanceof Object ? Object.getOwnPropertyNames(desc.value.value).length : 0, objectId:desc.value.objectId || ""}})
    }
    sendResult({result:results})
  };
  RuntimeAgent.prototype.wrapObject = function(object, objectGroup, forceValueType) {
    var remoteObject;
    remoteObject = new RemoteObject(object, forceValueType);
    this.objects[remoteObject.objectId] = {objectGroup:objectGroup, value:object, remoteObject:remoteObject};
    return remoteObject
  };
  RuntimeAgent.prototype.getRemoteObjectById = function(id) {
    return this.objects[id] ? this.objects[id].remoteObject : null
  };
  RuntimeAgent.prototype.getObjectByRemoteId = function(id) {
    return this.objects[id] ? this.objects[id].value : null
  };
  RuntimeAgent.prototype.createThrownValue = function(value, objectGroup) {
    var remoteObject = this.wrapObject(value, objectGroup);
    try {
      remoteObject.description = "" + value
    }catch(e) {
    }
    return{wasThrown:true, result:remoteObject}
  };
  RuntimeAgent.prototype.callFunctionOn = function(params, sendResult) {
    var object = this.objects[params.objectId];
    if(helpers.isUndefined(object)) {
      console.error("RuntimeAgent.callFunctionOn: Unknown object");
      return
    }
    object = object.value;
    var resolvedArgs = [];
    var args = params.arguments;
    if(args) {
      for(var i = 0;i < args.length;++i) {
        var objectId = args[i].objectId;
        if(objectId) {
          var resolvedArg = this.objects[objectId];
          if(!resolvedArg) {
            console.error("RuntimeAgent.callFunctionOn: Unknown object");
            return
          }
          resolvedArgs.push(resolvedArg.value)
        }else {
          if("value" in args[i]) {
            resolvedArgs.push(args[i].value)
          }else {
            resolvedArgs.push(undefined)
          }
        }
      }
    }
    var objectGroup = this.objects[params.objectId].objectGroup;
    try {
      var func = eval.call(global, "(" + params.functionDeclaration + ")");
      if(typeof func !== "function") {
        console.error("RuntimeAgent.callFunctionOn: Expression does " + "not evaluate to a function");
        return
      }
      return sendResult({result:this.wrapObject(func.apply(object, resolvedArgs), objectGroup, params.returnByValue), wasThrown:false})
    }catch(e) {
      return sendResult(this.createThrownValue(e, objectGroup))
    }
  };
  RuntimeAgent.prototype.releaseObjectGroup = function(params, sendResult) {
    for(var key in this.objects) {
      var value = this.objects[key];
      if(value.objectGroup === params.objectGroup) {
        delete this.objects[key]
      }
    }
    sendResult({})
  };
  RuntimeAgent.prototype.releaseObject = function(params, sendResult) {
    delete this.objects[params.objectId];
    sendResult({})
  };
  devtools.inspector.RuntimeAgent = RuntimeAgent
})();
(function() {
  function TimelineAgent(notify) {
    this.notify = notify;
    this.enabled = false;
    this.maxCallStackDepth = 5;
    this.includeMemoryDetails = true;
    this.timer = null
  }
  (function() {
    this.enable = function(params, sendResult) {
      this.enabled = true;
      sendResult({result:this.enabled})
    };
    this.disable = function(params, sendResult) {
      this.enabled = false;
      sendResult({})
    };
    this.eventRecorded = function(message) {
      var memory = app.memory;
      this.notify({method:"Timeline.eventRecorded", params:{record:{startTime:Date.now(), endTime:Date.now(), data:{"message":message || ""}, type:"Memory", usedHeapSize:memory.used, totalHeapSize:memory.total}}})
    };
    this.start = function(params, sendResult) {
      this.maxCallStackDepth = params && params.maxCallStackDepth || 5;
      sendResult({});
      this.notify({method:"Timeline.started", params:{}});
      var self = this;
      this.timer = setInterval(function() {
        self.eventRecorded()
      }, 1E3)
    };
    this.stop = function(params, sendResult) {
      sendResult({});
      clearInterval(this.timer);
      var self = this;
      this.notify({method:"Timeline.stopped", params:{}})
    };
    this.setIncludeMemoryDetails = function(params, sendResult) {
      this.includeMemoryDetails = params.enabled || true;
      sendResult({})
    }
  }).call(TimelineAgent.prototype);
  devtools.inspector.TimelineAgent = TimelineAgent
})();
(function() {
  function WorkerAgent() {
  }
  WorkerAgent.prototype = {enable:function(params, sendResult) {
    sendResult({result:true})
  }};
  devtools.inspector.WorkerAgent = WorkerAgent
})();
(function() {
  if(!devtools.internal) {
    devtools.internal = {}
  }
  var ns = devtools.internal;
  var data = "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";
  var Artwork = function() {
    this.initialize.apply(this, arguments)
  };
  Artwork.prototype = Object.create(Object, {initialize:{value:function() {
    var img = new Image;
    img.src = "data:image/png;base64," + data;
    this._loaded = false;
    this._onloadCallback = null;
    var self = this;
    img.onload = function() {
      self._spriteSheet = new BitmapData(this);
      self._onload()
    }
  }}, _onload:{value:function() {
    this._loaded = true;
    if(this.onload) {
      this.onload()
    }
  }}, onload:{get:function() {
    return this._onloadCallback
  }, set:function(value) {
    this._onloadCallback = value;
    if(this._loaded) {
      this._onloadCallback()
    }
  }}, createBitmap:{value:function(area, name) {
    var bmp = new Bitmap(this._spriteSheet, true, true, area);
    bmp.name = name ? name : null;
    return bmp
  }}, reload:{get:function() {
    return this.createBitmap(new Rectangle(55 * 0, 55 * 0, 55, 55), "reload")
  }}, gc:{get:function() {
    return this.createBitmap(new Rectangle(55 * 1, 55 * 0, 55, 55), "gc")
  }}, logout:{get:function() {
    return this.createBitmap(new Rectangle(55 * 2, 55 * 0, 55, 55), "logout")
  }}, log:{get:function() {
    return this.createBitmap(new Rectangle(55 * 0, 55 * 1, 55, 55), "log")
  }}, texture:{get:function() {
    return this.createBitmap(new Rectangle(55 * 1, 55 * 1, 55, 55), "texture")
  }}, change:{get:function() {
    return this.createBitmap(new Rectangle(55 * 2, 55 * 1, 55, 55), "change")
  }}, eraser:{get:function() {
    return this.createBitmap(new Rectangle(55 * 0, 55 * 2, 55, 55), "eraser")
  }}, arrow_left:{get:function() {
    return this.createBitmap(new Rectangle(55 * 1, 55 * 2, 55, 55), "arrow_left")
  }}, arrow_right:{get:function() {
    return this.createBitmap(new Rectangle(55 * 2, 55 * 2, 55, 55), "arrow_right")
  }}, handle_symbol:{get:function() {
    return this.createBitmap(new Rectangle(55 * 3, 55 * 0, 55, 55), "handle_symbol")
  }}, handle_bg:{get:function() {
    return this.createBitmap(new Rectangle(55 * 3, 55 * 1, 55 - 0.5, 55 * 2), "handle_bg")
  }}, scroll_bar:{get:function() {
    var bmp = this.createBitmap(new Rectangle(55 * 4, 55 * 0, 12, 13), "scroll_bar");
    bmp.scale9Grid = new Rectangle(6, 6, 1, 1);
    return bmp
  }}, black:{get:function() {
    return this.createBitmap(new Rectangle(55 * 4 + 1, 55 * 1 + 1, 1, 1), "black")
  }}});
  ns.artwork = new Artwork
})();
(function() {
  if(!devtools.internal) {
    devtools.internal = {}
  }
  var ns = devtools.internal;
  ns.createCircularBuffer = function(length, def) {
    var cursor = 0, buffer = new Array(length);
    buffer.__proto__ = null;
    for(var i = 0;i < length;i++) {
      buffer[i] = def || 0
    }
    return{get:function(index) {
      return buffer[(cursor + index) % length]
    }, push:function(item) {
      buffer[cursor] = item;
      cursor = (length + cursor + 1) % length
    }, length:length}
  };
  ns.Class = function(parent, impl) {
    var cls = function() {
      this.initialize.apply(this, arguments)
    };
    cls.prototype = Object.create(parent.prototype, impl);
    return cls
  };
  ns.Context = ns.Class(Object, {initialize:{value:function() {
    this._messageListeners = {}
  }}, message:{value:function(message, argument) {
    if(!(message in this._messageListeners)) {
      return
    }
    var listeners = this._messageListeners[message];
    for(var i = 0, len = listeners.length;i < len;i++) {
      listeners[i](argument)
    }
  }}, listen:{value:function(message, listener) {
    if(!(message in this._messageListeners)) {
      this._messageListeners[message] = []
    }
    this._messageListeners[message].push(listener)
  }}, unlisten:{value:function(message, listener) {
    if(!(message in this._messageListeners)) {
      return
    }
    var index = this._messageListeners[message].indexOf(listener);
    if(index == -1) {
      return
    }
    this._messageListeners[message].splice(index, 1)
  }}});
  var nativeConsoleLog = console.log;
  var nativeOnUncaughtError = window.onUncaughtError;
  ns.InspectorView = ns.Class(ns.Context, {initialize:{value:function() {
    ns.Context.prototype.initialize.call(this);
    this._stage = new Stage(100, 100);
    this._container = this._stage.addChild(new Sprite);
    this._container.name = "container";
    this._layer = new Layer(this._stage);
    window.addLayer(this._layer);
    this._tiny = new TinyGL(100, 100);
    this._tinyLayer = new Layer(this._tiny);
    this._bg = (new TinyGLRectangle).addTo(this._tiny).colors(2986344448);
    this._border = this.container.addChild(ns.artwork.black);
    this._border.alpha = 0.5;
    this._mainPanel = (new ns.MainPanel(this)).addTo(this.container);
    this._subPanel = (new ns.SubPanel(this)).addTo(this.container);
    this._handle = (new ns.PullHandle(this)).addTo(this.container);
    this.mainPanel.hide();
    this.subPanel.hide();
    this._onOrientationChange = null;
    this._onEnterFrame = null;
    this._isShown = false;
    this._visible = true;
    this._offset = 0;
    var self = this;
    console.log = function() {
      self.log.apply(self, arguments)
    };
    window.onUncaughtError = function() {
      self._onUncaughtError.apply(self, arguments)
    };
    this._handle.onChangeValue = function(value) {
      if(self.offset == 0 && self._handle.getState() === ns.PullHandle.State.MANUAL) {
        return false
      }
      self.offset = value;
      if(self._handle.getState() === ns.PullHandle.State.WAIT && value == 1) {
        self.hide()
      }
      return true
    };
    this._handle.onChangeState = function(state) {
      if(state !== ns.PullHandle.State.WAIT) {
        self.show()
      }
      if(state == ns.PullHandle.State.WAIT && this.offsetPercent == 0) {
        this.listenScreenTouch()
      }
    };
    this._handle.onFlickToLeft = function() {
      this.open()
    };
    this._handle.onFlickToRight = function() {
      this.close();
      this.unlistenScreenTouch()
    };
    this._handle.onTouchBegin = function() {
      this.symbol.alpha = 0.8;
      this.bg.alpha = 0.7;
      this.bg.scaleX = this.bg.scaleY = 1.2;
      this.symbol.x = -this.symbol.width;
      this.symbol.y = -this.symbol.height / 2;
      this.bg.x = -this.bg.width;
      this.bg.y = -this.bg.height / 2
    };
    this._handle.onTouchEnd = function() {
      if(this.state === ns.PullHandle.State.WAIT && self.offset != 0) {
        this.offsetPercent > 0.5 ? this.close() : this.open()
      }
      this.symbol.alpha = 0.6;
      this.bg.alpha = 0.3;
      this.bg.scaleX = this.bg.scaleY = 1;
      this.symbol.x = -this.symbol.width;
      this.symbol.y = -this.symbol.height / 2;
      this.bg.x = -this.bg.width;
      this.bg.y = -this.bg.height / 2
    };
    window.addEventListener("added", function(e) {
      window.removeEventListener("added", arguments.callee);
      window.addLayer(self._tinyLayer);
      window.addLayer(self._layer);
      self.message("changeLayerDepth");
      window.addEventListener("added", arguments.callee)
    });
    window.addEventListener("resize", this._onOrientationChange = function() {
      self._layOut()
    });
    this._stage.addEventListener("enterFrame", this._onEnterFrame = function(e) {
      self._sendEnterFrameMessage(e)
    });
    setTimeout(function() {
      self._layOut();
      self.offset = 1
    }, 0)
  }}, tiny:{get:function() {
    return this._tiny
  }}, stage:{get:function() {
    return this._stage
  }}, container:{get:function() {
    return this._container
  }}, mainPanel:{get:function() {
    return this._mainPanel
  }}, subPanel:{get:function() {
    return this._subPanel
  }}, orientationIsHorizontal:{get:function() {
    return window.innerWidth > window.innerHeight
  }}, offset:{get:function() {
    return this._offset
  }, set:function(val) {
    this._offset = val;
    this._tinyLayer.offsetX = val;
    this.container.x = this._stage.stageWidth * val;
    this.message("changeOffset", val)
  }}, isShown:{get:function() {
    return this._isShown
  }}, show:{value:function() {
    if(this.isShown) {
      return
    }
    this._isShown = true;
    window.addLayer(this._layer);
    window.addLayer(this._tinyLayer);
    this.mainPanel.show();
    this.subPanel.show();
    var self = this;
    this._layOut()
  }}, hide:{value:function() {
    if(!this.isShown) {
      return
    }
    this._isShown = false;
    window.removeLayer(this._tinyLayer);
    this.mainPanel.hide();
    this.subPanel.hide()
  }}, visible:{get:function() {
    return this._visible
  }, set:function(value) {
    if(this._visible == value) {
      return
    }
    this._visible = value;
    if(this._visible) {
      this.show();
      window.addLayer(this._layer)
    }else {
      this.hide();
      window.removeLayer(this._layer)
    }
  }}, log:{value:function() {
    this.mainPanel._logView.log.apply(this.mainPanel._logView, arguments);
    nativeConsoleLog.apply(console, arguments)
  }}, _sendEnterFrameMessage:{value:function(e) {
    this.message("enterFrame")
  }}, _onUncaughtError:{value:function(e) {
    this.message("error", e);
    this._handle.open();
    if(nativeOnUncaughtError) {
      nativeOnUncaughtError.apply(window, arguments)
    }
  }}, _layOut:{value:function() {
    var width;
    var height;
    var globalPoint = this.container.localToGlobal(new Point(0, 0));
    if(this.orientationIsHorizontal) {
      var width = 640 * (window.innerWidth / window.innerHeight) * 2 / 3;
      var height = 640 * 2 / 3;
      this._tiny.width = this._stage.stageWidth = width;
      this._tiny.height = this._stage.stageHeight = height;
      this._bg.tl(0, 0).br(width, height);
      var borderWidth = 3;
      this.mainPanel.offset(0, 0).resize(height - 25, height);
      this._border.x = height - 25;
      this._border.width = borderWidth;
      this._border.height = height;
      this._border.visible = true;
      this.subPanel.offset(height - 25 + borderWidth, 0).resize(width - (height - 25 + borderWidth), height);
      this._handle.offset(0, height / 2);
      this._handle.setArea(0, width)
    }else {
      var width = 640 * 2 / 3;
      var height = 640 * (window.innerHeight / window.innerWidth) * 2 / 3;
      this._tiny.width = this._stage.stageWidth = width;
      this._tiny.height = this._stage.stageHeight = height;
      this._bg.width = width;
      this._bg.height = height;
      this._bg.tl(0, 0).br(width, height);
      this.mainPanel.offset(0, 0).resize(width, width + 25);
      this._border.visible = false;
      this.subPanel.offset(0, width + 25).resize(width, height - (width + 25));
      this._handle.offset(0, height / 2);
      this._handle.setArea(0, width)
    }
    this.offset = this.offset
  }}});
  setTimeout(function() {
    devtools.view = new ns.InspectorView
  }, 0)
})();
(function() {
  devtools.internal.View = devtools.internal.Class(Object, {initialize:{value:function(context) {
    this._context = context;
    this._container = new Sprite;
    this.rect = {x:0, y:0, width:0, height:0}
  }}, tiny:{get:function() {
    return this._context.tiny
  }}, container:{get:function() {
    return this._container
  }}, context:{get:function() {
    return this._context
  }}, isShown:{get:function() {
    return this.container.visible
  }}, addTo:{value:function(parent) {
    parent.addChild(this.container);
    return this
  }}, removeFromParent:{value:function() {
    if(this.container.parent) {
      this.container.parent.removeChild(this.container)
    }
    return this
  }}, resize:{value:function(width, height) {
    this.rect.width = width;
    this.rect.height = height;
    return this
  }}, offset:{value:function(x, y) {
    this.rect.x = this.container.x = x;
    this.rect.y = this.container.y = y;
    return this
  }}, show:{value:function() {
    this.container.visible = true;
    return this
  }}, hide:{value:function() {
    this.container.visible = false;
    return this
  }}})
})();
(function() {
  var View = devtools.internal.View;
  devtools.internal.TextView = devtools.internal.Class(View, {initialize:{value:function(context) {
    View.prototype.initialize.call(this, arguments);
    this._tf = new TextField;
    this._tf.autoSize = "left";
    this._tf.multiline = true;
    this.container.addChild(this.tf)
  }}, tf:{get:function() {
    return this._tf
  }}, setTextFormat:{value:function(fmt) {
    this._tf.defaultTextFormat = fmt
  }}, resize:{value:function(width, height) {
    View.prototype.resize.apply(this, arguments);
    this.tf.width = width;
    this.tf.height = height;
    return this
  }}, text:{get:function() {
    return this.tf.text
  }, set:function(value) {
    this.tf.text = value
  }}})
})();
(function() {
  var View = devtools.internal.View;
  devtools.internal.ButtonView = devtools.internal.Class(View, {initialize:{value:function() {
    View.prototype.initialize.call(this, arguments);
    this.onTap = null;
    var self = this;
    this.container.addEventListener("touchTap", function() {
      if(self.onTap) {
        self.onTap()
      }
    })
  }}})
})();
(function() {
  var ns = devtools.internal;
  var View = devtools.internal.View;
  devtools.internal.GraphView = devtools.internal.Class(View, {initialize:{value:function(context) {
    View.prototype.initialize.apply(this, arguments);
    this.container.name = "graph_view";
    this.label_fps60 = new TextField;
    this.label_fps60.defaultTextFormat = new TextFormat(null, 13, 16757760);
    this.label_fps60.autoSize = "left";
    this.label_fps60.text = "60";
    this.container.addChild(this.label_fps60);
    this.label_fps30 = new TextField;
    this.label_fps30.defaultTextFormat = new TextFormat(null, 13, 16757760);
    this.label_fps30.autoSize = "left";
    this.label_fps30.text = "30";
    this.container.addChild(this.label_fps30);
    this.label_mem100 = new TextField;
    this.label_mem100.defaultTextFormat = new TextFormat(null, 15, 16711680, null, null, null, null, null, "right");
    this.label_mem100.width = 200;
    this.label_mem100.height = 20;
    this.label_mem100.text = "mem: m% n / nKB";
    this.container.addChild(this.label_mem100);
    this.label_doc = new TextField;
    this.label_doc.defaultTextFormat = new TextFormat(null, 15, 16777215);
    this.label_doc.width = 100;
    this.label_doc.height = 20;
    this.label_doc.text = "doc:0";
    this.container.addChild(this.label_doc);
    this.items = {memory:{data:ns.createCircularBuffer(20), object:(new TinyGLTriangleStrip).colors(2868838400).addTo(this.tiny)}, fps:{data:ns.createCircularBuffer(20), currentCount:0, prevStamp:null, object:(new TinyGLTriangleStrip).colors(2868884480).addTo(this.tiny)}, doc:{data:ns.createCircularBuffer(20), object:(new TinyGLTriangleStrip).colors(2868903935).addTo(this.tiny), max:1}};
    this.bg = this.container.addChildAt(ns.artwork.black, 0);
    this.bg.alpha = 0.5;
    var self = this;
    context.listen("enterFrame", function() {
      self.notifyEnterFrame()
    });
    context.listen("changeOffset", function() {
      self.update()
    })
  }}, resize:{value:function(width, height) {
    View.prototype.resize.apply(this, arguments);
    var globalPoint = this.container.localToGlobal(new Point(0, 0));
    var textHeight = 22;
    this.bg.width = width;
    this.bg.height = textHeight;
    this.update();
    this.label_fps30.y = textHeight - this.label_fps30.height / 2 + (this.rect.height - textHeight) * (1 - 30 / 90);
    this.label_fps60.y = textHeight - this.label_fps60.height / 2 + (this.rect.height - textHeight) * (1 - 60 / 90);
    this.label_doc.y = -1 + (textHeight - this.label_doc.height) / 2;
    this.label_mem100.y = -1 + (textHeight - this.label_mem100.height) / 2;
    this.label_mem100.x = width - this.label_mem100.width - 6;
    return this
  }}, notifyEnterFrame:{value:function() {
    var timestamp = Date.now();
    if(this.items.fps.prevStamp === null) {
      this.items.fps.prevStamp = timestamp
    }
    if(this.items.fps.prevStamp <= timestamp - 1E3) {
      this.items.fps.data.push(this.items.fps.currentCount);
      this.items.fps.currentCount = 0;
      this.items.fps.prevStamp = timestamp;
      var mem = app.memory;
      this.items.memory.data.push({used:mem.used, total:mem.total});
      this.label_mem100.text = "mem: " + Math.ceil(mem.used / mem.total * 100) + "% " + Math.round(mem.used / (1024 * 1024)) / 1 + " / " + Math.round(mem.total / (1024 * 1024)) / 1 + "MB";
      var doc = devtools.getDisplayObjectCount();
      this.label_doc.text = "doc:" + doc;
      this.items.doc.data.push(doc);
      this.items.doc.max = Math.max(this.items.doc.max, doc);
      this.update()
    }
    this.items.fps.currentCount++
  }}, update:{value:function() {
    var globalPoint = new Point(this.container.parent.x, this.container.parent.y);
    var textHeight = 22;
    var data = this.items.fps.data;
    var object = this.items.fps.object;
    var max = Number.MIN_VALUE, min = Number.MAX_VALUE;
    for(var i = 0;i < data.length;i++) {
      max = Math.max(max, data.get(i));
      min = Math.min(min, data.get(i))
    }
    var points = new Array(data.length * 4);
    var xSpan = this.rect.width / (data.length - 1);
    for(var i = 0;i < data.length;i++) {
      points[i * 4 + 0] = globalPoint.x + i * xSpan;
      points[i * 4 + 1] = textHeight + globalPoint.y + 1 + (this.rect.height - textHeight) * (1 - data.get(i) / 90);
      points[i * 4 + 2] = globalPoint.x + i * xSpan;
      points[i * 4 + 3] = textHeight + globalPoint.y - 1 + (this.rect.height - textHeight) * (1 - data.get(i) / 90)
    }
    object.points.apply(object, points);
    data = this.items.memory.data;
    object = this.items.memory.object;
    var points = new Array(data.length * 4);
    for(var i = 0;i < data.length;i++) {
      var dat = data.get(i);
      if(dat === 0) {
        dat = {used:0, total:100}
      }
      points[i * 4 + 0] = globalPoint.x + i * xSpan;
      points[i * 4 + 1] = textHeight + globalPoint.y + 1 + (this.rect.height - textHeight) * (1 - dat.used / dat.total);
      points[i * 4 + 2] = globalPoint.x + i * xSpan;
      points[i * 4 + 3] = textHeight + globalPoint.y - 1 + (this.rect.height - textHeight) * (1 - dat.used / dat.total)
    }
    object.points.apply(object, points);
    data = this.items.doc.data;
    object = this.items.doc.object;
    var max = this.items.doc.max;
    var points = new Array(data.length * 4);
    for(var i = 0;i < data.length;i++) {
      points[i * 4 + 0] = globalPoint.x + i * xSpan;
      points[i * 4 + 1] = textHeight + globalPoint.y + 1 + (this.rect.height - textHeight) * (1 - data.get(i) / max);
      points[i * 4 + 2] = globalPoint.x + i * xSpan;
      points[i * 4 + 3] = textHeight + globalPoint.y - 1 + (this.rect.height - textHeight) * (1 - data.get(i) / max)
    }
    object.points.apply(object, points)
  }}})
})();
(function() {
  var ns = devtools.internal;
  var View = devtools.internal.View;
  devtools.internal.LogView = devtools.internal.Class(View, {initialize:{value:function(context) {
    View.prototype.initialize.call(this, context);
    this.container.name = "log_view";
    this.tfs = [];
    this.fmts = {error:new TextFormat(null, 15, 16711680), log:new TextFormat(null, 12, 16777215)};
    this.container.mask = this.container.addChild(new Bitmap(new BitmapData(1, 1, true, 4294901760)));
    this.container.mask.visible = false;
    this.container.hitArea = this.container.addChild(new Bitmap(new BitmapData(1, 1, true, 4294901760)));
    this.container.hitArea.alpha = 0;
    this.container.hitArea.name = "hitArea";
    this._clearBtn = (new ns.ButtonView).addTo(this.container);
    var clearBmp = this._clearBtn.container.addChild(ns.artwork.eraser);
    clearBmp.x = -clearBmp.width / 2;
    clearBmp.y = -clearBmp.height / 2;
    this._clearBtn.container.scaleX = this._clearBtn.container.scaleY = 0.8;
    this._lines = (new TinyGLTriangleStrip).addTo(this.tiny).colors(1090519039);
    this._scrollBar = (new TinyGLRectangle).addTo(this.tiny).colors(1090519039);
    this.logOffset = 0;
    this.logRows = [];
    var fmt = {id:"log_0", text:"message", type:"log", tf:null};
    this.tf_log_dictionary = {};
    this.tracking = {prev:null, vec:null, reverb:null};
    var self = this;
    this._clearBtn.onTap = function() {
      self.clear()
    };
    this._onTouchBegin = function(e) {
      self.onTouchBegin(e)
    };
    this._onTouchMove = function(e) {
      self.onTouchMove(e)
    };
    this._onTouchEnd = function(e) {
      self.onTouchEnd(e)
    };
    this._onEnterFrame = function(e) {
      self.onEnterFrame(e)
    };
    this.container.addEventListener("touchBegin", this._onTouchBegin);
    this.context.listen("error", function(error) {
      self.onUncaughtError(error)
    });
    context.listen("changeOffset", function() {
      self.updateLines()
    })
  }}, onTouchBegin:{value:function(e) {
    this.container.stage.addEventListener("touchMove", this._onTouchMove);
    this.container.stage.addEventListener("touchEnd", this._onTouchEnd);
    this.container.stage.removeEventListener("enterFrame", this._onEnterFrame);
    this.container.stage.addEventListener("enterFrame", this._onEnterFrame);
    this.tracking.prev = {x:e.stageX, y:e.stageY};
    this.tracking.vec = {x:0, y:0};
    this.tracking.reverb = null
  }}, onTouchMove:{value:function(e) {
    var curr = {x:e.stageX, y:e.stageY};
    this.tracking.vec.x += curr.x - this.tracking.prev.x;
    this.tracking.vec.y += curr.y - this.tracking.prev.y;
    this.tracking.prev = curr
  }}, onTouchEnd:{value:function(e) {
    this.tracking.reverb = {x:this.tracking.vec.x, y:this.tracking.vec.y};
    this.container.stage.removeEventListener("touchMove", this._onTouchMove);
    this.container.stage.removeEventListener("touchEnd", this._onTouchEnd)
  }}, onEnterFrame:{value:function(e) {
    if(this.tracking.reverb !== null) {
      this.tracking.reverb.x *= 0.9;
      this.tracking.reverb.y *= 0.9;
      this.tracking.vec.x = this.tracking.reverb.x;
      this.tracking.vec.y = this.tracking.reverb.y;
      if(Math.abs(this.tracking.reverb.y) <= 12) {
        this.tracking.reverb = null;
        this.container.stage.removeEventListener("enterFrame", this._onEnterFrame)
      }
    }
    if(this.tracking.vec.y === 0) {
      return
    }
    var surplus = this.tracking.vec.y % 12;
    var value = (this.tracking.vec.y - surplus) / 12;
    this.tracking.vec.y = surplus;
    this.logOffset += value;
    if(this.logOffset >= this.logRows.length) {
      this.logOffset = this.logRows.length - 1
    }
    if(this.logOffset < 0) {
      this.logOffset = 0
    }
    this.update()
  }}, resize:{value:function(width, height) {
    View.prototype.resize.apply(this, arguments);
    this.container.mask.width = this.container.hitArea.width = width;
    this.container.mask.height = this.container.hitArea.height = height;
    this.update();
    this._clearBtn.offset(-10 + width - this._clearBtn.container.width / 2, -35 + height - this._clearBtn.container.height / 2);
    return this
  }}, log:{value:function() {
    var row = "";
    for(var i = 0;i < arguments.length;i++) {
      row += arguments[i] + ", "
    }
    row = row.substr(0, row.length - 2);
    this.logRows.push({id:"log_" + this.logRows.length, text:row, type:"log", tf:null});
    this.update()
  }}, onUncaughtError:{value:function() {
    var err = arguments[0];
    var message = "";
    if(err.stack) {
      message += err.message;
      if(err.stack) {
        message = err.stack
      }
    }else {
      message += err.message;
      message += " url:" + err.sourceURL + " line:" + err.line
    }
    this.logRows.push({id:"log_" + this.logRows.length, text:message, type:"error", tf:null});
    this.update()
  }}, clear:{value:function() {
    for(var i = 0;i < this.tfs.length;i++) {
      this.tfs[i].row = null
    }
    this.logOffset = 0;
    this.logRows = [];
    this.update()
  }}, update:{value:function() {
    var offset = this.logOffset;
    for(var i = 0;i < this.tfs.length;i++) {
      this.tfs[i].visible = false
    }
    var sumHeight = 0;
    var index = this.logRows.length - 1 - offset;
    var linePoints = [];
    var globalPoint = this.container.localToGlobal(new Point(0, 0));
    for(var i = index + 1;i < this.logRows.length;i++) {
      if(this.logRows[i].tf) {
        this.logRows[i].tf.row = null;
        this.logRows[i].tf = null
      }else {
        break
      }
    }
    while(this.rect.height > sumHeight) {
      var row = this.logRows[index];
      if(!row) {
        break
      }
      var tf = row.tf && row.tf.row === row ? row.tf : null;
      if(tf === null) {
        for(var i = 0;i < this.tfs.length;i++) {
          if(this.tfs[i].row === null) {
            tf = this.tfs[i];
            break
          }
        }
        if(tf === null) {
          tf = new TextField;
          this.container.addChild(tf);
          tf.autoSize = "left";
          tf.wordWrap = true;
          tf.id = "tf_" + this.tfs.length;
          tf.row = null;
          tf.mouseEnabled = false;
          this.tfs.push(tf);
          this._clearBtn.addTo(this.container)
        }
        row.tf = tf;
        tf.row = row;
        tf.defaultTextFormat = this.fmts[row.type];
        tf.text = row.text;
        tf.width = tf.cacheWidth = this.rect.width;
        tf.cacheHeight = tf.height
      }
      if(tf.cacheWidth != this.rect.width) {
        tf.width = tf.cacheWidth = this.rect.width
      }
      sumHeight += tf.cacheHeight;
      tf.y = this.rect.height - sumHeight;
      tf.visible = true;
      var offsetX = globalPoint.x;
      var offsetY = globalPoint.y + this.rect.height - sumHeight + tf.height;
      linePoints.push(offsetX, offsetY - 1, offsetX, offsetY - 1, offsetX, offsetY, this.rect.width + offsetX, offsetY - 1, this.rect.width + offsetX, offsetY, this.rect.width + offsetX, offsetY);
      index--
    }
    for(var i = index;i >= 0;i--) {
      if(this.logRows[i].tf) {
        this.logRows[i].tf.row = null;
        this.logRows[i].tf = null
      }else {
        break
      }
    }
    this._lines.points.apply(this._lines, linePoints);
    this._scrollBar.tl(globalPoint.x + this.rect.x + this.rect.width - 7, globalPoint.y + this.rect.height * ((index + 1) / this.logRows.length)).br(globalPoint.x + this.rect.x + this.rect.width - 0, globalPoint.y + this.rect.height * ((this.logRows.length - offset) / this.logRows.length))
  }}, updateLines:{value:function() {
    var linePoints = [];
    var offset = this.logOffset;
    var sumHeight = 0;
    var index = this.logRows.length - 1 - offset;
    var globalPoint = this.container.localToGlobal(new Point(0, 0));
    while(this.rect.height > sumHeight) {
      var row = this.logRows[index];
      if(!row) {
        break
      }
      var tf = row.tf && row.tf.row === row ? row.tf : null;
      if(tf === null) {
        for(var i = 0;i < this.tfs.length;i++) {
          if(this.tfs[i].row === null) {
            tf = this.tfs[i];
            break
          }
        }
        if(tf === null) {
          tf = new TextField;
          this.container.addChild(tf);
          tf.autoSize = "left";
          tf.wordWrap = true;
          tf.id = "tf_" + this.tfs.length;
          tf.row = null;
          tf.mouseEnabled = false;
          this.tfs.push(tf);
          this._clearBtn.addTo(this.container)
        }
        row.tf = tf;
        tf.row = row;
        tf.defaultTextFormat = this.fmts[row.type];
        tf.text = row.text
      }
      sumHeight += tf.height;
      var offsetX = globalPoint.x;
      var offsetY = globalPoint.y + this.rect.height - sumHeight + tf.height;
      linePoints.push(offsetX, offsetY - 1, offsetX, offsetY - 1, offsetX, offsetY, this.rect.width + offsetX, offsetY - 1, this.rect.width + offsetX, offsetY, this.rect.width + offsetX, offsetY);
      index--
    }
    for(var i = index;i >= 0;i--) {
      if(this.logRows[i].tf) {
        this.logRows[i].tf.row = null;
        this.logRows[i].tf = null
      }else {
        break
      }
    }
    this._lines.points.apply(this._lines, linePoints)
  }}, show:{value:function() {
    View.prototype.show.call(this);
    this._lines.addTo(this.tiny);
    this._scrollBar.addTo(this.tiny)
  }}, hide:{value:function() {
    View.prototype.hide.call(this);
    this._lines.removeFrom(this.tiny);
    this._scrollBar.removeFrom(this.tiny)
  }}})
})();
(function() {
  var ns = devtools.internal;
  var View = devtools.internal.View;
  devtools.internal.TextureView = devtools.internal.Class(View, {initialize:{value:function(context) {
    View.prototype.initialize.apply(this, arguments);
    this.container.name = "texture_view";
    this.tf = new TextField;
    this.container.addChild(this.tf);
    this.tf.text = "0/0";
    this.tf.autoSize = "left";
    this.tf.defaultTextFormat = new TextFormat(null, 20, 16777215);
    this.tf.alpha = 1;
    this._arrowLeft = (new ns.ButtonView(this.context)).addTo(this.container);
    var bmp = this._arrowLeft.container.addChild(ns.artwork.arrow_left);
    bmp.x = -bmp.width / 2;
    bmp.y = -bmp.height / 2;
    this._arrowRight = (new ns.ButtonView(this.context)).addTo(this.container);
    bmp = this._arrowRight.container.addChild(ns.artwork.arrow_right);
    bmp.x = -bmp.width / 2;
    bmp.y = -bmp.height / 2;
    this._index = 0;
    this.texView = new GLTextureView(0);
    this.textureLayer = new Layer(this.texView);
    this.textureLayer.alpha = 0.6;
    this.texMatrix = new Matrix;
    this._showTexture(0);
    var self = this;
    this._arrowLeft.onTap = function() {
      self._showTexture(-1)
    };
    this._arrowRight.onTap = function() {
      self._showTexture(+1)
    };
    this.context.listen("changeLayerDepth", function() {
      if(!self.isShown) {
        return
      }
      var index = window.getLayerIndex(self.context._layer);
      window.addLayerAt(self.textureLayer, index - 1)
    });
    this.context.listen("changeOffset", function() {
      self.textureLayer.offsetX = self.context.offset
    })
  }}, offsetX:{get:function() {
    return this.textureLayer.offsetX
  }, set:function(val) {
    this.textureLayer.offsetX = val
  }}, prev:{value:function() {
    this._showTexture(-1);
    return this
  }}, next:{value:function() {
    this._showTexture(+1);
    return this
  }}, show:{value:function() {
    View.prototype.show.call(this);
    var index = window.getLayerIndex(this.context._layer);
    window.addLayerAt(this.textureLayer, index - 1);
    this._showTexture(0);
    return this
  }}, hide:{value:function() {
    View.prototype.hide.call(this);
    window.removeLayer(this.textureLayer);
    return this
  }}, offset:{value:function(x, y) {
    View.prototype.offset.call(this, x, y);
    this.textureLayer.offsetY = y / this.container.stage.stageHeight;
    return this
  }}, resize:{value:function(width, height) {
    View.prototype.resize.apply(this, arguments);
    if(this.context.orientationIsHorizontal) {
      this.textureLayer.scaleMode = "noScale";
      this.textureLayer.horizontalAlign = "left";
      this.textureLayer.verticalAlign = "center"
    }else {
      this.textureLayer.scaleMode = "noScale";
      this.textureLayer.horizontalAlign = "left";
      this.textureLayer.verticalAlign = "center"
    }
    if(this.textureLayer.content) {
      var xscale = this.rect.width * this.context._layer.contentScaleX / this.textureLayer.content.naturalWidth;
      var yscale = this.rect.height * this.context._layer.contentScaleY / this.textureLayer.content.naturalHeight;
      this.texMatrix.a = this.texMatrix.d = Math.min(xscale, yscale);
      this.textureLayer.content.matrix = this.texMatrix
    }
    this.tf.x = width - this.tf.width - 40;
    this.tf.y = height - this.tf.height - 10;
    this._arrowLeft.offset(1 + this.tf.x - 40 + this.tf.width / 2, 1 + this.tf.y + this.tf.height / 2);
    this._arrowRight.offset(1 + this.tf.x + 40 + this.tf.width / 2, 1 + this.tf.y + this.tf.height / 2);
    return this
  }}, _showTexture:{value:function(val) {
    var numOfTextures = GLTextureView.getNumOfTextures();
    if(numOfTextures <= 0) {
      return
    }
    this._index += val;
    while(this._index < 0) {
      this._index += numOfTextures
    }
    while(this._index >= numOfTextures) {
      this._index -= numOfTextures
    }
    this.tf.text = "" + (this._index + 1) + "/" + numOfTextures;
    this.texView.index = this._index
  }}})
})();
(function() {
  var ns = devtools.internal;
  var View = ns.View;
  var MODE_OEF = true;
  var FLICK_FILTER = 0.04;
  var State = {WAIT:"wait", MANUAL:"manual", AUTO_OPEN:"auto_open", AUTO_CLOSE:"auto_close"};
  devtools.internal.PullHandle = ns.Class(View, {initialize:{value:function(context) {
    View.prototype.initialize.apply(this, arguments);
    this.bg = this.container.addChild(ns.artwork.handle_bg);
    this.symbol = this.container.addChild(ns.artwork.handle_symbol);
    this.bg.x = -this.bg.width;
    this.bg.y = -this.bg.height / 2;
    this.bg.alpha = 0.3;
    this.symbol.x = -this.symbol.width;
    this.symbol.y = -this.symbol.height / 2;
    this.symbol.alpha = 0.6;
    this.state = State.WAIT;
    this.offsetPercent = 1;
    this.area = {offset:0, size:100};
    this.tracking = {prevTouch:null, vec:{x:0, y:0}, ave:null, onScreen:false};
    this._onTouchBegin = function(e) {
      self.__onTouchBegin(e)
    };
    this._onTouch = function(e) {
      self.__onTouch(e)
    };
    var self = this;
    this.container.addEventListener("touchBegin", this._onTouchBegin);
    this.context.listen("enterFrame", function() {
      self.notifyEnterFrame()
    });
    this.onChangeValue = null;
    this.onChangeState = null;
    this.onFlickToRight = null;
    this.onTouchBegin = null;
    this.onTouchEnd = null
  }}, setArea:{value:function(offset, size) {
    this.area = {offset:offset, size:size}
  }}, getState:{value:function() {
    return this.state
  }}, _setState:{value:function(state) {
    if(this.state === state) {
      return
    }
    this.state = state;
    if(this.onChangeState) {
      this.onChangeState(state)
    }
  }}, listenScreenTouch:{value:function() {
    this.context.stage.addEventListener("touchBegin", this._onTouchBegin)
  }}, unlistenScreenTouch:{value:function() {
    this.context.stage.removeEventListener("touchBegin", this._onTouchBegin)
  }}, __onTouchBegin:{value:function(e) {
    e.stopPropagation();
    this._setState(State.MANUAL);
    var self = this;
    window.addEventListener("touchmove", this._onTouch);
    window.addEventListener("touchend", this._onTouch);
    window.addEventListener("touchcancel", this._onTouch);
    this.tracking.vec = {x:0, y:0};
    this.tracking.ave = null;
    this.tracking.prevTouch = null;
    this.tracking.onScreen = true;
    if(this.onTouchBegin) {
      this.onTouchBegin()
    }
  }}, __onTouch:{value:function(e) {
    var t = e.changedTouches.item(0);
    switch(e.type) {
      case "touchmove":
        if(this.tracking.prevTouch == null) {
          this.tracking.prevTouch = {x:t.x, y:t.y}
        }
        this.tracking.vec.x += t.x - this.tracking.prevTouch.x;
        this.tracking.vec.y += t.y - this.tracking.prevTouch.y;
        this.tracking.prevTouch = {x:t.x, y:t.y};
        if(!MODE_OEF) {
          if(this.tracking.ave == null) {
            this.tracking.ave = {x:this.tracking.vec.x, y:this.tracking.vec.y}
          }
          this.tracking.ave.x = this.tracking.ave.x / 2 + this.tracking.vec.x / 2;
          this.tracking.ave.y = this.tracking.ave.y / 2 + this.tracking.vec.y / 2;
          var tmp = this.offsetPercent;
          tmp += this.tracking.vec.x / window.innerWidth * this.container.stage.stageWidth / this.area.size;
          tmp = tmp > 1 ? 1 : tmp < 0 ? 0 : tmp;
          this.tracking.vec = {x:0, y:0};
          if(this.offsetPercent == tmp) {
            break
          }
          if(this.onChangeValue) {
            if(this.onChangeValue(this.offsetPercent)) {
              this.offsetPercent = tmp
            }
          }
        }
        break;
      case "touchend":
      ;
      case "touchcancel":
        window.removeEventListener("touchmove", this._onTouch);
        window.removeEventListener("touchend", this._onTouch);
        window.removeEventListener("touchcancel", this._onTouch);
        if(this.tracking.prevTouch != null) {
          this.tracking.vec.x += t.x - this.tracking.prevTouch.x;
          this.tracking.vec.y += t.y - this.tracking.prevTouch.y
        }
        if(this.tracking.ave == null) {
          this.tracking.ave = {x:this.tracking.vec.x, y:this.tracking.vec.y}
        }
        this.tracking.ave.x = this.tracking.ave.x / 2 + this.tracking.vec.x / 2;
        this.tracking.ave.y = this.tracking.ave.y / 2 + this.tracking.vec.y / 2;
        var prev = this.state;
        this._setState(State.WAIT);
        if(prev === State.MANUAL) {
          var flickValue = this.tracking.ave.x / Math.min(window.innerWidth, window.innerHeight);
          if(flickValue < -FLICK_FILTER) {
            if(this.onFlickToLeft) {
              this.onFlickToLeft()
            }
          }else {
            if(flickValue > FLICK_FILTER) {
              if(this.onFlickToRight) {
                this.onFlickToRight()
              }
            }
          }
        }
        this.tracking.onScreen = false;
        this.tracking.prevTouch = null;
        if(this.onTouchEnd) {
          this.onTouchEnd()
        }
        break
    }
  }}, open:{value:function() {
    if(this.offsetPercent === 0 || this.state === State.AUTO_OPEN) {
      return
    }
    this._setState(State.AUTO_OPEN)
  }}, close:{value:function() {
    if(this.offsetPercent === 1 || this.state === State.AUTO_CLOSE) {
      return
    }
    this._setState(State.AUTO_CLOSE)
  }}, notifyEnterFrame:{value:function(e) {
    switch(this.state) {
      case State.AUTO_OPEN:
        this.offsetPercent += (0 - this.offsetPercent) * 0.3;
        if(this.offsetPercent <= 0.0050) {
          this.offsetPercent = 0;
          this._setState(State.WAIT)
        }
        if(this.onChangeValue) {
          this.onChangeValue(this.offsetPercent)
        }
        break;
      case State.AUTO_CLOSE:
        this.offsetPercent += (1 - this.offsetPercent) * 0.3;
        if(this.offsetPercent > 1 - 0.0050) {
          this.offsetPercent = 1;
          this._setState(State.WAIT)
        }
        if(this.onChangeValue) {
          this.onChangeValue(this.offsetPercent)
        }
        break;
      case State.MANUAL:
        if(MODE_OEF) {
          if(this.tracking.ave == null) {
            this.tracking.ave = {x:this.tracking.vec.x, y:this.tracking.vec.y}
          }
          this.tracking.ave.x = this.tracking.ave.x / 2 + this.tracking.vec.x / 2;
          this.tracking.ave.y = this.tracking.ave.y / 2 + this.tracking.vec.y / 2;
          var tmp = this.offsetPercent;
          tmp += this.tracking.vec.x / window.innerWidth * this.container.stage.stageWidth / this.area.size;
          tmp = tmp > 1 ? 1 : tmp < 0 ? 0 : tmp;
          this.tracking.vec = {x:0, y:0};
          if(this.offsetPercent == tmp) {
            break
          }
          if(this.onChangeValue) {
            if(this.onChangeValue(this.offsetPercent)) {
              this.offsetPercent = tmp
            }
          }
        }
        break
    }
  }}, resize:{value:function(width, height) {
    View.prototype.resize.apply(this, arguments);
    this.container.width = width;
    this.container.height = height;
    return this
  }}});
  devtools.internal.PullHandle.State = State
})();
(function() {
  var ns = devtools.internal;
  var View = devtools.internal.View;
  devtools.internal.MainPanel = devtools.internal.Class(View, {initialize:{value:function(context) {
    View.prototype.initialize.apply(this, arguments);
    this.container.name = "main_panel";
    this._ipTF = this.container.addChild(new TextField);
    this._ipTF.autoSize = "left";
    this._ipTF.text = "IP:" + app.activeNetworkIP;
    this._ipTF.defaultTextFormat = new TextFormat(null, 15, 16777215);
    this._ipBG = this.container.addChildAt(ns.artwork.black, 0);
    this._ipBG.alpha = 0.5;
    this._logView = (new ns.LogView(context)).addTo(this.container);
    this._textureView = (new ns.TextureView(context)).addTo(this.container);
    this.showLog();
    var self = this;
    context.listen("showLog", function() {
      self.showLog()
    });
    context.listen("showTexture", function() {
      self.showTexture()
    })
  }}, showLog:{value:function() {
    this._logView.show();
    this._textureView.hide()
  }}, showTexture:{value:function() {
    this._logView.hide();
    this._textureView.show()
  }}, resize:{value:function(width, height) {
    View.prototype.resize.call(this, width, height);
    var globalPoint = this.container.localToGlobal(new Point(0, 0));
    var textHeight = 22;
    this._ipTF.x = (width - this._ipTF.width) / 2;
    this._ipTF.y = -1 + (textHeight - this._ipTF.height) / 2;
    this._ipBG.width = width;
    this._ipBG.height = textHeight;
    this._logView.offset(0, textHeight).resize(width, height - textHeight);
    this._textureView.offset(0, textHeight).resize(width, height - textHeight);
    return this
  }}})
})();
(function() {
  var ns = devtools.internal;
  var View = devtools.internal.View;
  devtools.internal.MenuView = ns.Class(View, {initialize:{value:function(context) {
    View.prototype.initialize.apply(this, arguments);
    this.container.name = "menu_view";
    this._movableContainer = this.container.addChild(new Sprite);
    var items = [{name:"show log", icon:ns.artwork.log, message:"showLog", func:null}, {name:"show texture", icon:ns.artwork.texture, message:"showTexture", func:null}, {name:"execute gc", icon:ns.artwork.gc, message:"executeGC", func:function() {
      app.gc()
    }}, {name:"reload", icon:ns.artwork.reload, message:"reload", func:function() {
      location.reload()
    }}, {name:"change project", icon:ns.artwork.change, message:"changeProject", func:function() {
      app.sendMessage("changeProject")
    }}, {name:"logout", icon:ns.artwork.logout, message:"logout", func:function() {
      console.log("logout");
      app.sendMessage("logout")
    }}];
    this._handle = (new ns.PullHandle(context)).addTo(this._movableContainer);
    this.bg = this._movableContainer.addChildAt(ns.artwork.black, 0);
    this.bg.alpha = 0.3;
    var self = this;
    this.menus = [];
    for(var i = 0, len = items.length;i < len;i++) {
      var item = items[i];
      var menu = (new ns.ButtonView(context)).addTo(this._movableContainer);
      menu.item = item;
      var icon = menu.container.addChild(item.icon);
      icon.x = -icon.width / 2;
      icon.y = -icon.height / 2;
      menu.onTap = function() {
        self.context.message(this.item.message);
        if(this.item.func) {
          this.item.func()
        }
      };
      this.menus.push(menu)
    }
    var self = this;
    this._handle.onChangeValue = function(value) {
      self._movableContainer.x = value * self._handle.area.size;
      self.resize(self.rect.width, self.rect.height);
      return true
    };
    this._handle.onChangeState = function(state) {
    };
    this._handle.onFlickToLeft = function() {
      this.open()
    };
    this._handle.onFlickToRight = function() {
      this.close()
    };
    this._handle.onTouchEnd = function() {
      if(this.state === ns.PullHandle.State.WAIT) {
        this.offsetPercent < 0.5 ? this.open() : this.close()
      }
    };
    setTimeout(function() {
      self._handle.onChangeValue(1)
    }, 100)
  }}, resize:{value:function(width, height) {
    View.prototype.resize.apply(this, arguments);
    var handleSize = 80;
    if(this.context.orientationIsHorizontal) {
      this._handle.offset(this._handle.container.width, height / 2).resize(handleSize / 2, handleSize);
      var w = width - this._handle.container.width;
      var h = height;
      this.bg.x = handleSize / 2;
      this.bg.y = 0;
      this.bg.width = width;
      this.bg.height = height;
      var xi, yi;
      var rows = 2;
      for(var i = 0, len = this.menus.length;i < len;i++) {
        var menuButton = this.menus[i];
        xi = i % (len / rows);
        yi = Math.floor(i / (len / rows));
        menuButton.offset(this._handle.container.width + w * (xi + 0.5) / (len / rows + 0), height * ((1 + yi) / (1 + rows)))
      }
      this._handle.setArea(0, width - this._handle.container.width);
      this._movableContainer.x = this._handle.offsetPercent * this._handle.area.size
    }else {
      this._handle.offset(this._handle.container.width, height / 2).resize(handleSize / 2, handleSize);
      var w = width - this._handle.container.width;
      this.bg.x = handleSize / 2;
      this.bg.y = (height - handleSize) / 2;
      this.bg.width = width;
      this.bg.height = handleSize;
      var xi;
      for(var i = 0, len = this.menus.length;i < len;i++) {
        var menuButton = this.menus[i];
        xi = i;
        menuButton.offset(this._handle.container.width + w * (xi + 0.5) / (len + 0), height / 2)
      }
      this._handle.setArea(0, width - this._handle.container.width);
      this._movableContainer.x = this._handle.offsetPercent * this._handle.area.size
    }
    return this
  }}})
})();
(function() {
  var ns = devtools.internal;
  var View = devtools.internal.View;
  devtools.internal.SubPanel = devtools.internal.Class(View, {initialize:{value:function(context) {
    View.prototype.initialize.apply(this, arguments);
    this.container.name = "sub_panel";
    this._graphView = (new ns.GraphView(context)).addTo(this.container);
    this._border = this.container.addChild(ns.artwork.black);
    this._border.alpha = 0.5;
    this._menuView = (new ns.MenuView(context)).addTo(this.container)
  }}, resize:{value:function(width, height) {
    View.prototype.resize.call(this, width, height);
    this._graphView.resize(width, height);
    this._menuView.resize(width, height);
    var globalPoint = this.container.localToGlobal(new Point(0, 0));
    if(this.context.orientationIsHorizontal) {
      var borderHeight = 10;
      this._graphView.offset(0, 0).resize(width, height / 2);
      this._border.y = height / 2;
      this._border.width = width;
      this._border.height = borderHeight;
      this._menuView.offset(0, height / 2 + borderHeight).resize(width, height / 2 - borderHeight)
    }else {
      var borderHeight = 5;
      this._graphView.offset(0, 0).resize(width, height / 2);
      this._border.y = height / 2;
      this._border.width = width;
      this._border.height = borderHeight;
      this._menuView.offset(0, height / 2 + borderHeight).resize(width, height / 2 - borderHeight)
    }
    return this
  }}})
})();

