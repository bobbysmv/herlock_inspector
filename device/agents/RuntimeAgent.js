// 本来のRuntimeAgentはブラウザ側にある。コレ自体はConsole.evaluateの委譲先として機能する。

//Code was based on /WebKit/Source/WebCore/inspector/InjectedScriptSource.js
var _objectId = 0;
var RemoteObject = function(object, forceValueType) {
    this.type = typeof object;

    if (helpers.isPrimitiveValue(object) ||
        object === null || forceValueType) {
        // We don't send undefined values over JSON.
        if (typeof object !== "undefined") {
            this.value = object;
        }

        // Null object is object with 'null' subtype'
        if (object === null) {
            this.subtype = "null";
        }

        // Provide user-friendly number values.
        if (typeof object === "number") {
            this.description = object + "";
        }
        return;
    }

    this.objectId = /*smv*/"console_"+JSON.stringify({ injectedScriptId: 0, id: _objectId++});
    var subtype = helpers.subtype(object);
    if (subtype) this.subtype = subtype;

    this.className = object.constructor || object.name || '';
    this.description = helpers.describe(object);
    this.value = helpers.decycle(object);
};

var getPropertyDescriptors = function(object, ownProperties) {
    var descriptors = [];
    var nameProcessed = {};
    nameProcessed.__proto__ = null;

    for (var o = object; helpers.isObject(o); o = o.__proto__) {
        var names = Object.getOwnPropertyNames(o);
        for (var i = 0; i < names.length; ++i) {
            var name = names[i];
            if (nameProcessed[name]) {
                continue;
            }

            var descriptor = {};
            try {
                nameProcessed[name] = true;
                descriptor = Object.getOwnPropertyDescriptor(object, name);
                if (!descriptor) {
                    try {
                        descriptors.push({
                            name: name,
                            value: object[name],
                            writable: false,
                            configurable: false,
                            enumerable: false
                        });
                    } catch (e) {
                        // Silent catch.
                    }
                    continue;
                }
            } catch (e) {
                descriptor = {};
                descriptor.value = e;
                descriptor.wasThrown = true;
            }

            descriptor.name = name;
            descriptors.push(descriptor);
        }

        if (ownProperties) {
            if (object.__proto__) {
                descriptors.push({
                    name: "__proto__",
                    value: object.__proto__,
                    writable: true,
                    configurable: true,
                    enumerable: false
                });
            }
            break;
        }
    }
    return descriptors;
};

function RuntimeAgent( notify, v8Client ) {
    this.notify = notify;
    //this.client = v8Client;
    // remote objects
    this.objects = {};
}

RuntimeAgent.prototype.evaluate = function(params, sendResult) {
    var result = null;
    try {
        result = eval.call( global, "with ({}) {\n" + params.expression + "\n}");
    } catch (e) {
        e.stack = "";
        return sendResult(this.createThrownValue(e, params.objectGroup));
    }

    sendResult({
        result: this.wrapObject(result, params.objectGroup),
        wasThrown: false
    });
};


RuntimeAgent.prototype.getProperties = function(params, sendResult) {
    var object = this.objects[params.objectId];

    if (helpers.isUndefined(object)) {
        console.error('RuntimeAgent.getProperties: Unknown object');
        return;
    }

    object = object.value;
    var descriptors = getPropertyDescriptors(object, params.ownProperties);
    var len = descriptors.length;

    if ( len === 0 && "arguments" in object)
        for (var key in object)
            descriptors.push({ name: key, value: object[key], writable: false, configurable: false, enumerable: true });

    for (var i = 0; i < len; ++i) {
        var descriptor = descriptors[i];
        if ("get" in descriptor) descriptor.get = this.wrapObject(descriptor.get);
        if ("set" in descriptor) descriptor.set = this.wrapObject(descriptor.set);
        if ("value" in descriptor) descriptor.value = this.wrapObject(descriptor.value);
        if ("get" in descriptor && !descriptor.value) descriptor.value = this.wrapObject( object[descriptor.name] );//SMV
        if (!("configurable" in descriptor)) descriptor.configurable = false;
        if (!("enumerable" in descriptor)) descriptor.enumerable = false;
    }

    //sendResult({ result: descriptors });
    // SMV
    var results = [];
    for (var i = 0; i < len; ++i) {
        var desc = descriptors[i];
        if( desc.name === "_nativejs_private_holder" )continue;
        results.push({
            name: desc.name,
            value:{
                type: desc.value.type,
                description: desc.value.description || ""+desc.value.value,
                hasChildren: desc.value.value instanceof Object ? Object.getOwnPropertyNames(desc.value.value).length :0,
                objectId: desc.value.objectId || ""
            }
        });
    }

    sendResult({ result: results });
};
// 本家とフォーマットが違う。要調整
RuntimeAgent.prototype.getProperties_BK = function(params, sendResult) {
    var object = this.objects[params.objectId];

    if (helpers.isUndefined(object)) {
        console.error('RuntimeAgent.getProperties: Unknown object');
        return;
    }

    object = object.value;
    var descriptors = getPropertyDescriptors(object, params.ownProperties);
    var len = descriptors.length;

    if ( len === 0 && "arguments" in object)
        for (var key in object)
            descriptors.push({ name: key, value: object[key], writable: false, configurable: false, enumerable: true });

    for (var i = 0; i < len; ++i) {
        var descriptor = descriptors[i];
        if ("get" in descriptor) descriptor.get = this.wrapObject(descriptor.get);
        if ("set" in descriptor) descriptor.set = this.wrapObject(descriptor.set);
        if ("value" in descriptor) descriptor.value = this.wrapObject(descriptor.value);
        if (!("configurable" in descriptor)) descriptor.configurable = false;
        if (!("enumerable" in descriptor)) descriptor.enumerable = false;
    }

    sendResult({ result: descriptors });
};

RuntimeAgent.prototype.wrapObject = function(object, objectGroup, forceValueType) {
    var remoteObject;

    //try {
        remoteObject = new RemoteObject(object, forceValueType);

    /*} catch (e) {
        var description = "<failed to convert exception to string>";
        try {
            description = helpers.describe(e);
        } catch (ex) {}
        remoteObject = new RemoteObject(description, forceValueType);
    }*/

    this.objects[remoteObject.objectId] = {
        objectGroup: objectGroup,
        value: object
    };
    return remoteObject;
};

RuntimeAgent.prototype.createThrownValue = function(value, objectGroup) {
    var remoteObject = this.wrapObject(value, objectGroup);
    try {
        remoteObject.description = '' + value;
    } catch (e) {}

    return {
        wasThrown: true,
        result: remoteObject
    };
};

RuntimeAgent.prototype.callFunctionOn = function(params, sendResult) {
    var object = this.objects[params.objectId];

    if (helpers.isUndefined(object)) {
        console.error('RuntimeAgent.callFunctionOn: Unknown object');
        return;
    }

    object = object.value;
    var resolvedArgs = [];

    var args = params.arguments;

    if (args) {
        for (var i = 0; i < args.length; ++i) {
            var objectId = args[i].objectId;
            if (objectId) {
                var resolvedArg = this.objects[objectId];
                if (!resolvedArg) {
                    console.error('RuntimeAgent.callFunctionOn: Unknown object');
                    return;
                }

                resolvedArgs.push(resolvedArg.value);
            } else if ("value" in args[i]) {
                resolvedArgs.push(args[i].value);
            } else {
                resolvedArgs.push(undefined);
            }
        }
    }

    var objectGroup = this.objects[params.objectId].objectGroup;
    try {
        var func = eval.call(global, ("(" + params.functionDeclaration + ")"));
        if (typeof func !== "function") {
            console.error('RuntimeAgent.callFunctionOn: Expression does ' +
                'not evaluate to a function');
            return;
        }

        return sendResult({
            result: this.wrapObject(func.apply(object, resolvedArgs), objectGroup, params.returnByValue),
            wasThrown: false
        });
    } catch (e) {
        return sendResult( this.createThrownValue(e, objectGroup) );
    }
};

RuntimeAgent.prototype.releaseObjectGroup = function(params, sendResult) {
    for (var key in this.objects) {
        var value = this.objects[key];
        if (value.objectGroup === params.objectGroup) {
            delete this.objects[key];
        }
    }
    sendResult({});
};

RuntimeAgent.prototype.releaseObject = function(params, sendResult) {
    delete this.objects[params.objectId];
    sendResult({});
};


