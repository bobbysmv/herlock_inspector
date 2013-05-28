window.DebuggerAgentCreate;
(function(){

    /**
     * v8依存
     * @param config
     * @return {*}
     * @constructor
     */
    DebuggerAgentCreate = function ( config ) {
        var v8 = null,
            sock = null,
        //map from sourceID:lineNumber to breakpoint
            breakpoints = {},
        //map from sourceID to filename
            sourceIDs = {},
        //milliseconds to wait for a lookup
            LOOKUP_TIMEOUT = 2500,
        //node function wrapper
            FUNC_WRAP = /^\(function \(exports, require, module, __filename, __dirname\) \{ ([\s\S]*)\n\}\);$/,
        //
            cpuProfileCount = 0;

        // setBreakpointByUrl用
        var script_url_id_dictionary = {};

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
            return wrapperObject(ref.type, desc, kids, 0, 0, ref.handle);
        }

        function callFrames(bt) {
            if ( bt.body.totalFrames > 0 ) {
                return bt.body.frames.map( function ( frame ) {
                    return {
                        type: 'function',
                        functionName: frame.func.inferredName,
                        sourceID: frame.func.scriptId,
                        line: frame.line,// + 1,
                        location: { sourceID: frame.func.scriptId, lineNumber: frame.line },// + 1 },
                        id: frame.index,
                        worldId: 1,
                        scopeChain: frame.scopes.map( function(scope) {
                            var c = {};
                            switch ( scope.type ) {
                                case 0: // global
                                    c.type = "global";
                                    break;
                                case 1: // this
                                    c.type = "local";
                                    c.isLocal = true;
                                    c.object = wrapperObject(
                                            'object',
                                            frame.receiver.className,
                                            true,
                                            frame.index,
                                            scope.index,
                                            frame.receiver.ref );
                                    break;
                                case 2: // with
                                    c.type = "with";
                                    c.isWithBlock = true;
                                    break;
                                case 3: // closure
                                    c.type = "closure";
                                    c.isClosure = true;
                                    break;
                                case 4: // HTMLElement?
                                    c.type = "??";
                                    c.isElement = true;
                                    break;
                                default:
                                    break;
                            }
                            c.objectId = frame.index + ':' + scope.index + ':backtrace';
                            c.object = c.object||{};//smv
                            c.object.objectId = c.objectId;//smv
                            return c;
                        })
                    };
                });
            } else {
                return [ { type:'program', sourceID:'internal', line:0, id:0, worldId:1, scopeChain:[]} ];
            }
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
            v8.request( 'backtrace', {arguments:{ inlineRefs:true }}, function (msg) {
                    sendEvent( 'paused', { details:{ callFrames:callFrames(msg) }} );
                });
        }

        function breakEvent(obj) {
            var source = sourceIDs[ obj.body.script.id ];
            var args;
            if (!source) {
                args = { arguments:{ includeSource:true, types:4, ids:[obj.body.script.id] } };
                v8.request('scripts', args, parsedScripts );
            } else if (source.hidden) {
                v8.request('continue', { arguments:{stepaction:'out'}});
                return;
            }

            sendBacktrace();
        }


        /*
         "scriptId",
         "url",
         "startLine",
         "startColumn",
         "endLine",
         "endColumn",
         "isContentScript",
         "sourceMapURL"
         */
        function parsedScripts(msg) {
            var scripts = msg.body.map(function (s) {
                return s;
            });

            scripts.forEach(function (s) {
                var hidden = config.hidden && config.hidden.some(function (r) { return r.test(s.url); });
                var item = { hidden:hidden, path:s.name, url: s.name };
                sourceIDs[s.id] = item;
                if (!hidden) { sendEvent('scriptParsed', {
                    "scriptId": s.id.toString(),
                    "url": s.name,
                    "startLine": s.lineOffset+1,
                    "startColumn": s.columnOffset,
                    "endLine": s.lineOffset + s.lineCount,
                    "endColumn": 0,
                    "isContentScript": false,
                    "sourceMapURL": s.name
                }); }
            });
            return scripts;
        }

        function sendEvent(name, data) {
            data = data || {};
            if (sock) {
                sock.onAgentMessage({
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
                sock.onAgentMessage({
                    data: JSON.stringify({
                        id:id,
                        result: data
                    })
                });
            }
        }

        function browserConnected() { // TODO find a better name

            var args = { arguments:{ includeSource:true, types:4 }};

            // initialize scripts
            v8.request('scripts', args, function (msg) {

                script_url_id_dictionary = {};
                var scripts = parsedScripts(msg); // dispatch parsed
                for( var i in scripts )
                    script_url_id_dictionary[scripts[i].name] = scripts[i].id;

                // deviceに保持されたbreakpointを開放


                v8.request('listbreakpoints', {},
                    function (msg) {
                        msg.body.breakpoints.forEach(function (bp) {
                            // clear breakpoint
                            v8.request( 'clearbreakpoint', { arguments: { breakpoint:bp.number } }, {} );
                        });

                        sendEvent('debuggerWasEnabled'); // storageに保存されていたbreakpointがrestoreされる
                        if (!msg.running) sendBacktrace();
                    });

            });
        }

        return Object.create( events.EventEmitter.prototype, {
            attach:{
                value:function () {
                    var self = this;

                    // v8 events
                    v8.on('break', breakEvent);
                    v8.on('close', function () {
                        //TODO determine proper close behavior
                        //v8 = { request:function () { console.error('debugger not sockected'); } };
                        //sendEvent('debuggerWasDisabled');
                        //self.close();
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

                    //
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
                    // TODO main thread停止状態を考慮しdeviceへの問い合わせはしない方向で
                    /*
                    function callback ( error, result ) {
                        if( result ) this.attach();
                    }

                    var id = InspectorBackend.registerCallbackAndIssueId( "Debugger.enable", callback.bind(this) );
                    sock.send( JSON.stringify({ id:id, method:"Debugger.enable" }) );
                    */
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
            getInspectorState:{
                value:function (seq) {
                    sendResponse(seq, true, {
                        state:{
                            monitoringXHREnabled:false,
                            resourceTrackingEnabled:false
                        }});
                }
            },
            getResourceContent:{
                value:function (identifier, encode) {
                    // ???
                }
            },
            clearConsoleMessages:{
                value:function () {
                    sendEvent('consoleMessagesCleared');
                }
            },
            //Debug
            setBreakpointByUrl:{
                value:function ( url, lineNumber, columnNumber, condition, callback ) {
                    // url to id
                    var scriptId = script_url_id_dictionary[url];
                    if( !scriptId ) {
                        console.log( JSON.stringify(script_url_id_dictionary));
                        return;
                    }
                    var id = InspectorBackend.registerCallbackAndIssueId( "Debugger.setBreakpointByUrl", callback );
                    //this.setBreakpoint( scriptId, lineNumber, true, condition, id );

                    v8.request(
                        'setbreakpoint',
                        { arguments:{
                            type:'scriptId',
                            target:scriptId,
                            line:lineNumber - 1,
                            enabled:true,
                            condition:condition
                        }},
                        function( msg ){
                            var locs = msg.body.actual_locations;
                            for(var i in locs)locs[i].lineNumber = locs[i].line;
                            sendResponse( id, msg.success, {
                                breakpointId: msg.body.breakpoint,
                                actualLocations: msg.body.actual_locations
                            } );
                        }
                    );
                }
            },
            removeBreakpoint:{
                value:function (breakpointId, callback) {

                    var id = InspectorBackend.registerCallbackAndIssueId( "Debugger.removeBreakpoint", callback );
                    v8.request(
                        'clearbreakpoint',
                        { arguments:{ breakpoint:breakpointId }},
                        function( msg ){
                            sendResponse( id, msg.success, {} );
                        });
                }
            },
            setBreakpointsActive:{
                value:function( flag ){
                    if(flag) this.activateBreakpoints();
                    else this.deactivateBreakpoints();
                }
            },
            activateBreakpoints:{
                value:function () {
                    Object.keys(breakpoints).forEach(
                        function (key) {
                            var bp = breakpoints[key];
                            v8.request(
                                'changebreakpoint',
                                { arguments:{
                                    breakpoint:bp.number,
                                    condition:bp.condition,
                                    enabled:true
                                }},
                                function (msg) {
                                    if (msg.success) {
                                        bp.enabled = true;
                                        sendEvent('restoredBreakpoint', bp);
                                    }
                                });
                        });
                }
            },
            deactivateBreakpoints:{
                value:function (injectedScriptId, objectGroup) {
                    Object.keys(breakpoints).forEach(
                        function (key) {
                            var bp = breakpoints[key];
                            v8.request(
                                'changebreakpoint',
                                { arguments:{
                                    breakpoint:bp.number,
                                    condition:bp.condition,
                                    enabled:false
                                }},
                                function (msg) {
                                    if (msg.success) {
                                        bp.enabled = false;
                                        sendEvent('restoredBreakpoint', bp);
                                    }
                                });
                        });
                }
            },
            pause:{
                value:function () {
                    v8.request('suspend', {}, function (msg) {
                        if (msg.running) return;
                        v8.request( 'backtrace', { arguments: { inlineRefs:true } }, function (msg) {
                            sendEvent( 'paused', { details: { callFrames: callFrames(msg) } } );
                        });
                    });
                }
            },
            resume:{
                value:function () {
                    v8.request('continue');
                    sendEvent('resumed');
                }
            },
            stepOver:{
                value:function () {
                    v8.request('continue', { arguments:{stepaction:'next'}});
                    sendEvent('resumed');
                }
            },
            stepInto:{
                value:function () {
                    v8.request('continue', { arguments:{stepaction:'in'}});
                    sendEvent('resumed');
                }
            },
            stepOut:{
                value:function () {
                    v8.request('continue', { arguments:{stepaction:'out'}});
                    sendEvent('resumed');
                }
            },
            setPauseOnExceptions:{
                value: function( state, callback ){
                    var id = InspectorBackend.registerCallbackAndIssueId( "Debugger.getScriptSource", callback );
                    this.setPauseOnExceptionsState(state,id);
                }
            },
            setPauseOnExceptionsState:{
                value:function (state, id) {
                    var params = {
                        arguments:{
                            flags:[
                                {
                                    name:'breakOnCaughtException',
                                    value:state === 1}
                            ]
                        }
                    };
                    v8.request('flags', params, function (msg) {
                        var value = 0;
                        if (msg.success) {
                            if (msg.body.flags.some(function (x) {
                                return x.name === 'breakOnCaughtException' && x.value
                            })) {
                                value = 1;
                            }
                            sendResponse(id, true, {pauseOnExceptionState:value});
                        }
                    });
                }
            },
            editScriptSource:{
                value:function (sourceID, newContent, seq) {
                    var args = {
                        script_id:sourceID,
                        preview_only:false,
                        new_source:newContent
                    };
                    v8.request(
                        'changelive',
                        {arguments:args},
                        function (msg) {
                            sendResponse(
                                seq,
                                true,
                                {
                                    success:msg.success,
                                    newBodyOrErrorMessage:msg.message || newContent
                                });
                            //TODO: new callframes?
                            if (msg.success && config.saveLiveEdit) {
                                var fs = require('fs'),
                                    match = FUNC_WRAP.exec(newContent),
                                    newSource;
                                if (match && sourceIDs[sourceID] && sourceIDs[sourceID].path) {
                                    newSource = match[1];
                                    fs.writeFile(sourceIDs[sourceID].path, newSource, function (e) {
                                        if (e) {
                                            var err = e.toString(),
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
                                        }
                                    });
                                }
                            }
                        });
                }
            },
            getScriptSource:{
                value:function (sourceID, callback) {
                    // unobserved / unverified
                    var id = InspectorBackend.registerCallbackAndIssueId( "Debugger.getScriptSource", callback );
                    var args = {
                        arguments:{
                            includeSource:true,
                            types:4,
                            ids:[sourceID] }};
                    v8.request('scripts', args, function (msg) {
                        sendResponse( id, msg.success, { scriptSource:msg.body[0].source });
                    });
                }
            },
            evaluateOnCallFrame:{ // break中のコンソール入力時 DebuggerPresentationModel:703
                value:function( callFrameId, expression, objectGroup, includeCommandLineAPI, callback ){
                    var id = InspectorBackend.registerCallbackAndIssueId( "Debugger.evaluateOnCallFrame", callback );

                    var args = { expression: expression, frame:callFrameId, disable_break: true };

                    v8.request( 'evaluate', { arguments: args }, function( msg ){
                        if( !msg.success ) return;//TODO
                        sendResponse( id, true, { result:refToObject(msg.body) });
                    });
                }
            }
        });
    };

})();
