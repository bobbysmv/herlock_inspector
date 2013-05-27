window.RuntimeAgentCreate;
(function(){

    /**
     * v8依存
     * @param config
     * @return {*}
     * @constructor
     */
    RuntimeAgentCreate = function ( config ) {
        var v8 = null,
            sock = null,
        //map from sourceID to filename
            sourceIDs = {},
        //milliseconds to wait for a lookup
            LOOKUP_TIMEOUT = 2500,
        //node function wrapper
            FUNC_WRAP = /^\(function \(exports, require, module, __filename, __dirname\) \{ ([\s\S]*)\n\}\);$/,


        sock = config.njsSock;
        v8 = config.v8;

        function wrapperObject(type, description, hasChildren, frame, scope, ref) {
            return {
                type:type,
                description:description,
                hasChildren:hasChildren,
                objectId:frame + ':' + scope + ':' + ref
            };
        }

        function refToObject(ref) {
            var desc = '',
                name,
                kids = ref.properties ? ref.properties.length : false;
            switch (ref.type) {
                case 'object':
                    name = /#<an?\s(\w+)>/.exec(ref.text);
                    if (name && name.length > 1) {
                        desc = name[1];
                        if (desc === 'Array') {
                            desc += '[' + (ref.properties.length - 1) + ']';
                        }
                        else if (desc === 'Buffer') {
                            desc += '[' + (ref.properties.length - 4) + ']';
                        }
                    }
                    else {
                        desc = ref.className || 'Object';
                    }
                    break;
                case 'function':
                    desc = ref.text || 'function()';
                    break;
                default:
                    desc = ref.text || '';
                    break;
            }
            if (desc.length > 100) {
                desc = desc.substring(0, 100) + '\u2026';
            }
            return wrapperObject(ref.type, desc, kids, 0, 0, ref.handle);//気に入らない 0, 0, 0が
        }

        function callFrames(bt) {
            if (bt.body.totalFrames > 0) {
                return bt.body.frames.map(function (frame) {
                    var f = {
                        type:'function',
                        functionName:frame.func.inferredName,
                        sourceID:frame.func.scriptId,
                        line:frame.line + 1,
                        location: { sourceID: frame.func.scriptId, lineNumber: frame.line + 1 },
                        id:frame.index,
                        worldId:1,
                        scopeChain:frame.scopes.map(
                            function (scope) {
                                var c = {};
                                switch (scope.type) {
                                    case 0: // global
                                        break;
                                    case 1: // this
                                        c.isLocal = true;
                                        c.object =
                                            wrapperObject(
                                                'object',
                                                frame.receiver.className,
                                                true,
                                                frame.index,
                                                scope.index,
                                                frame.receiver.ref);
                                        break;
                                    case 2: // with
                                        c.isWithBlock = true;
                                        break;
                                    case 3: // closure
                                        c.isClosure = true;
                                        break;
                                    case 4: //
                                        c.isElement = true;
                                        break;
                                    default:
                                        break;
                                }
                                c.objectId = frame.index + ':' + scope.index + ':backtrace';
                                return c;
                            })
                    };
                    return f;
                });
            }
            return [
                {
                    type:'program',
                    sourceID:'internal',
                    line:0,
                    id:0,
                    worldId:1,
                    scopeChain:[]}
            ];
        }

        function evaluate(expr, frame, andThen) {
            var args = {
                expression:expr,
                disable_break:true,
                global:true,
                maxStringLength:100000
            };
            if (frame != null) {
                args.frame = frame;
                args.global = false;
            }
            v8.request(
                'evaluate',
                { arguments:args},
                andThen);
        }

        function sendBacktrace() {
            v8.request(
                'backtrace',
                {arguments:{ inlineRefs:true }},
                function (msg) {
                    sendEvent(
                        'paused',
                        { details:{ callFrames:callFrames(msg) }});
                });
        }

        function sendEvent(name, data) {
            data = data || {};
            if (sock) {
                sock.onmessage({
                    data: JSON.stringify({
                        method: "Debugger."+name,
                        params: data
                    })
                });
            }
        }

        function sendResponse(id, success, data) {
            data = data || {};
            if (sock) {
                // TODO
                sock.onmessage({
                    data: JSON.stringify({
                        id:id,
                        result: data
                    })
                });
            }
        }

        return Object.create( events.EventEmitter.prototype, {
            attach:{
                value:function () {
                    var self = this;

                    // v8 events
                    v8.on('break', breakEvent);
                    v8.on('close', function () {
                        //TODO determine proper close behavior
                        v8 = {
                            request:function () {
                                console.error('debugger not sockected');
                            }
                        };
                        sendEvent('debuggerWasDisabled');
                        self.close();
                    });
                    //
                    v8.on('connect', function () { browserConnected(); });
                    if( v8.connected ) setTimeout( browserConnected,0 );
                    //
                    v8.on('exception', function (msg) { breakEvent(msg); });
                    //
                    v8.on('error', function (e) {
                        sendEvent('showPanel', { name:'console' });
                        var err = e.toString(), data;
                        if (err.match(/ECONNREFUSED/)) {
                            err += '\nIs node running with --debug port ' + debuggerPort + '?';
                        }
                        data = {
                            messageObj:{
                                source:3,
                                type:0,
                                level:3,
                                line:0,
                                url:'',
                                groupLevel:7,
                                repeatCount:1,
                                message:err
                            }
                        };
                        sendEvent('addConsoleMessage', data);
                    });
                }
            },
            close:{
                value:function () {
                    /*
                     if (v8 && v8.connected) v8.close();
                     */
                    this.emit('close');
                }
            },
            enable:{
                value:function (always) {
                    this.attach();

                }
            },
            disable:{
                value:function (always) {
                    /*
                     if (v8 && v8.connected) v8.close();
                     */
                }
            },
            populateScriptObjects:{
                value:function (seq) {
                    sendResponse(seq, true, {});
                }
            },
            /*
            evaluate:{ // ConsoleAgentへ移動
                value: function( expression, objectGroup, includeCommandLineAPI, callback ) {

                    // TODO optionals
                    var id = InspectorBackend.registerCallbackAndIssueId( "Runtime.evaluate", callback );
                    var args = { expression: expression, disable_break: true, global: true, maxStringLength: 100000 };
                    v8.request( 'evaluate', { arguments: args }, function( msg ){
                        if( !msg.success ) return;//TODO
                        sendResponse( id, true, { result:refToObject(msg.body) });
                    });

                }
            },
            */
            callFunctionOn:{
                value: function( objectId, functionDeclaration, arguments, returnByValue, callback ) {
                    var id = InspectorBackend.registerCallbackAndIssueId( "Runtime.callFunctionOn", callback );
                    // TODO
                    //sendResponse( id, true, { result:{}, wasThrown:false } );

                    var args = {
                        expression:expr,
                        disable_break:true,
                        global:true,
                        maxStringLength:100000
                    };
                    if (frame != null) {
                        args.frame = frame;
                        args.global = false;
                    }
                    v8.request( 'evaluate', { arguments: args }, function( msg ){
                        args
                    });
                }
            },
            getProperties:{
                value: function( objectId, ownProperties, callback ) {
                    var id = InspectorBackend.registerCallbackAndIssueId( "Runtime.getProperties", callback );

                    var tokens = objectId.split(':');

                    var frame = parseInt(tokens[0], 10);
                    var scope = parseInt(tokens[1], 10);
                    var ref = tokens[2];

                    if ( ref === 'backtrace' ) { // TODO
                        v8.request( 'scope', { arguments:{ number:scope, frameNumber:frame, inlineRefs:true } },
                            function (msg) {
                                if ( !msg.success ) return;
                                var refs = {};
                                if (msg.refs && Array.isArray(msg.refs))
                                    msg.refs.forEach(function (r) { refs[r.handle] = r; });

                                var props = msg.body.object.properties.map(function (p) {
                                    var r = refs[p.value.ref];
                                    return { name:p.name, value:refToObject(r) };
                                });
                                sendResponse(id, true, { result:props });
                            });
                    } else {
                        var handle = parseInt(ref, 10);
                        var timeout = setTimeout(function () {
                            sendResponse( id, true, { result:[ {
                                name:'sorry',
                                value:wrapperObject( 'string', 'lookup timed out', false, 0, 0, 0)
                            } ] } );
                        }, 1000 );
                        v8.request(
                            'lookup', { arguments:{ handles:[handle], includeSource:false } },
                            function (msg) {
                                clearTimeout(timeout);
                                if (!msg.success) return;
                                //TODO break out commonality with above
                                var refs = {};
                                var props = [];
                                if ( msg.refs && Array.isArray(msg.refs) ) {
                                    var obj = msg.body[handle];
                                    var objProps = obj.properties;
                                    var proto = obj.protoObject;
                                    msg.refs.forEach(function (r) { refs[r.handle] = r; });
                                    props = objProps.map(function (p) {
                                        var r = refs[p.ref];
                                        return { name:String(p.name), value:refToObject(r) };
                                    });
                                    if (proto)
                                        props.push( { name:'__proto__', value:refToObject(refs[proto.ref])} );
                                }
                                sendResponse( id, true, { result:props } );
                            });
                    }


                }
            },
            setProperty:{
                value: function( objectId, name, value, callback ) {
                    var id = InspectorBackend.registerCallbackAndIssueId( "Runtime.releaseObject", callback );
                    // TODO
                    sendResponse( id, true, {} );
                }
            },
            releaseObject:{
                value: function( objectId, callback ) {
                    var id = InspectorBackend.registerCallbackAndIssueId( "Runtime.releaseObject", callback );
                    // TODO
                    sendResponse( id, true, {} );
                    console.info( "call Runtime.releaseObject" );
                }
            },
            releaseObjectGroup:{
                value: function( objectGroup, callback ) {
                    var id = InspectorBackend.registerCallbackAndIssueId( "Runtime.releaseObjectGroup", callback );
                    // TODO
                    sendResponse( id, true, {} );
                    console.info( "call Runtime.releaseObjectGroup" );
                }
            }
        });
    };

})();
