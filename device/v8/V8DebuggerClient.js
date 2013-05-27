/**
 * V8とメッセージのやり取りをするための窓口
 * @param notify
 * @constructor
 */
var V8DebuggerClient = function(notify) {

    this.connected = false;
    this.reqSequence = 0;
    this.requests = {};
    this.notify = notify;
    this.queue = [];
    //this.port = 5858;
    this.protocol = null;

    var self = this;
    v8debugger.onV8Message = function( msg ){ self.onV8Response( { body:JSON.parse(msg) } ); };

    // smv
    this._cacheScripts = null;
    this._url_scriptId = null;
};

/**
 * Callback function that gets invoked once
 * a connection to the debuggee process is established.
 *
 * @api private
 */
V8DebuggerClient.prototype.onConnect = function() {
    this.connected = true;
    this.flushQueue();
};

/**
 * This callback function gets invoked by
 * nodejs v8 protocol implementation
 * once it receives the entire response
 * from v8 debug agent.
 *
 * @param {Object} response The response serialized
 * by the nodejs implementation of the v8 remote debugger protocol.
 * @api private
 */
V8DebuggerClient.prototype.onV8Response = function(response) {
    var payload = response.body;
    //console.log(payload);

    if ( payload.type == 'event' ) {

        if ( !translator[ payload.event ] )
            return console.log('webkit-devtools-agent: Translator function not found for event: ' + payload.event);
        //
        var result = translator[payload.event](payload);
        if( result ){
            console.log("v8 event: " + payload.event);
            console.log( "translated: " + result);
            this.notify( result );
        }


    } else if ( payload.type == 'response' ) {
        var callback = this.requests[payload.request_seq];
        //console.log("v8 response: " + JSON.stringify( payload ) );
        if ( callback ) {
            callback( payload );
            delete this.requests[ payload.request_seq];
        } else {
            console.log('webkit-devtools-agent: Unexpected message was received, there is no callback function to handle it :( :');
            console.log(payload);
        }

    } else {
        console.log('webkit-devtools-agent: Unrecognized message type received by DebuggerAgent: ');
        console.log(payload);
    }
};
/**
 * Callback function to received debug data coming out of
 * the debugee process.
 *
 * @param {Buffer} data Data sent by v8 debug agent
 * @api private
 */

V8DebuggerClient.prototype.onData = function(data) {
    this.protocol.execute(data);
};

/**
 * Callback function for `close` events in the
 * connection to the debugee process.
 *
 * @api private
 */
V8DebuggerClient.prototype.onClose = function() {
    this.connected = false;
};

/**
 * Callback function for `error` events in the
 * connection to the debuggee process.
 *
 * @param {Buffer} error JSON containing the error.
 * @api private
 */
V8DebuggerClient.prototype.onError = function(error) {
    console.error( "error :"+ error);
};

/**
 * Flushes the internal queue, sending
 * all the queued messages if
 * there is a valid connection to the
 * debugee process.
 *
 * @api private
 */
V8DebuggerClient.prototype.flushQueue = function() {
    if (!this.connected) {
        return;
    }

    var queue = this.queue;
    for (var i = 0, len = queue.length; i < len; i++) {
        var message = JSON.stringify(queue[i]);

        //removes message from the queue
        queue.splice(i, 1);
    }
};

/**
 * Sends out message to the debugee process
 * through an internal queue.
 *
 * @param {Object} data Object to be sent
 * @param {Function} callback Callback function
 * to invoke once the debug agent, in the debugee process,
 * get back to us with a response.
 *
 * @api public
 */
V8DebuggerClient.prototype.send = function(data, callback) {
    this.reqSequence++;

    data.seq = this.reqSequence;
    this.requests[data.seq] = callback;

    var message = JSON.stringify(data);
    v8debugger.sendV8Message( message );
};

/**
 * Establishes a connection to the
 * Debug Agent of the debuggee process and
 * sets up the callbacks to some events.
 *
 * @param {Function} callback Callback function
 * @api public
 */
V8DebuggerClient.prototype.connect = function(callback) {

    callback(translator.emptyResult());
};

/**
 * Disconnects from the debuggee process
 *
 * @param {Function} callback Callback function
 * @api public
 */
V8DebuggerClient.prototype.disconnect = function(callback) {
    /*
    callback();
    */
};

/**
 * Defines pause on exceptions state.
 * Can be set to stop on `all` exceptions,
 * `uncaught` exceptions or no exceptions.
 * Initial pause on exceptions state is none.
 *
 * Gotcha: V8 remote debugger protocol doesn't understand `none` as
 * break type, so we need to send `uncaught` and `enabled` equaling false
 * to represent `none`.
 *
 * @param {String} exceptionBreak Type of exception break
 * it can be `all` or `uncaught`.
 * @param {Function} callback Callback function to send back
 * the answer to this command. The response is returned
 * in the DevTools Remote Protocol format specified in:
 *  https://developers.google.com/chrome-developer-tools/docs/protocol/1.0/debugger#command-setPauseOnExceptions
 * @api public
 */
V8DebuggerClient.prototype.setExceptionBreak = function(exceptionBreak, callback) {
    var request = {
        type: 'request',
        command: 'setexceptionbreak',
        arguments: {
            type: exceptionBreak === 'none' ? 'uncaught': exceptionBreak,
            enabled: exceptionBreak == 'none' ? false : true
        }
    };

    this.send(request, callback);
};

V8DebuggerClient.prototype.setBreakpointByUrl = function ( url, lineNumber, enabled, condition, callback) {
    // url to id
    var id = this._url_scriptId[url];

    console.log( id + " : " + url );
    this.setBreakpoint( id, lineNumber, enabled, condition, callback );
}
V8DebuggerClient.prototype.setBreakpoint = function ( sourceID, lineNumber, enabled, condition, callback) {

    this.send({
        type:'request',
        command:'setbreakpoint',
        arguments:{
            type:'scriptId',
            target:sourceID,
            line:lineNumber - 1,
            enabled:enabled,
            condition:condition
        }
    }, function (result) {
        console.log( JSON.stringify(result) );

        if ( !result.success ) return;//throw error

        callback( result.body.breakpoint, result.body.actual_locations );
    });
};
V8DebuggerClient.prototype.removeBreakpoint = function ( breakpointId, callback) {

    this.send({
        type:'request',
        command:'clearbreakpoint',
        arguments:{ breakpoint:breakpointId }
    }, function (result) {
        console.log( JSON.stringify(result) );

        if ( !result.success ) return;//throw error

        callback(  );
    });
};

V8DebuggerClient.prototype.getScripts = function( callback ) {
    var self = this;
    var request = {
        type: 'request',
        command: 'scripts',
        arguments: {
            types: 4,
            includeSource: true
        }
    };

    if( !!this._cacheScripts ) {
        setTimeout( function(){
            var scripts = translator[ "scripts" ]( self._cacheScripts );
            callback( scripts );
        },0 );
    }

    this.send(request, function(result) {
        self._cacheScripts = result;
        var scripts = translator[ "scripts" ]( self._cacheScripts );
        self._url_scriptId = {};
        for(var i = 0; i < scripts.length; i++) {
            self._url_scriptId[ scripts[i].params.url ] = scripts[i].params.scriptId;
        }
        callback( scripts );
    });
};

V8DebuggerClient.prototype.getScriptSource = function( sourceId, callback ) {
    var self = this;
    var request = {
        type: 'request',
        command: 'scripts',
        arguments: {
            types: 4, //normal scripts
            includeSource: true,
            ids: [ parseInt(sourceId) ]
        }
    };

    this.send(request, function(result) {
        callback( result.body[0].source );
    });
};

V8DebuggerClient.prototype.pause = function( callback ) {
    var self = this;
    var request = {
        type: 'request',
        command: 'suspend',
        arguments: { }
    };

    this.send(request, function(result) {
        console.log(JSON.stringify(result));
        callback(  );
    });
};

//}).call(V8DebuggerClient.prototype);

