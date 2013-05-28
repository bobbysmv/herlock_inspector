(function(){

    var callbackHandler =( function() {
        var lastId = 1,
            callbacks = {};

        return Object.create({}, {
            wrap: {
                value: function(callback) {
                    var callbackId = lastId++;
                    callbacks[callbackId] = callback || function() {};
                    return callbackId;
                }
            },
            processResponse: {
                value: function(callbackId, args) {
                    var callback = callbacks[callbackId];
                    callback.apply(null, args);
                    delete callbacks[callbackId];
                }
            },
            removeResponseCallbackEntry: {
                value: function(callbackId) {
                    delete callbacks[callbackId];
                }
            }
        });
    })();


    window.events = {};
    events.EventEmitter = function(){};
    events.EventEmitter.prototype = {
        emit: function(){
            if( !this["on"+arguments[0]] ) return;
            var args=[];
            for( var i=1; i < arguments.length; i++ ) args.push(arguments[i]);
            this["on"+arguments[0]].apply( this, args );
        },
        on: function( name, func ){
            this["on"+name] = func;
        }
    };


    /**
     * messageのテンプレートを生成
     * @return {Object}
     */
    function makeMessage() {
        return { headersDone: false, headers: null, contentLength: 0 };
    }


    /**
     * デバイスとやり取りするInspectorに対してのV8ラッパー
     * WebSocket
     */
    window.V8Wrapper = function( ws ) {

        this._conn = ws;

        this._conn.on = function( name, func ){ this.addEventListener( name, func ); };

        var self = this;
        this._conn.on("open", function() { self.emit('connect'); });

        this._conn.on("message", function(msg) {
            if( msg.data.substr(0,3) !== "v8_" ) return;
            data = msg.data;
            self._parse( data.substr(3) );//"v8_"+JSON
        });

        this._conn.on('error', function(e) {
            console.log( "V8 error:" + e );
            self.emit('error', e);
        });

        this._conn.on('close', function() { self.emit('close'); });

        Object.defineProperty(this,"connected",{ get:function(){ return this._conn.readyState === WebSocket.OPEN; } })

    };

    V8Wrapper.prototype = new events.EventEmitter();


    V8Wrapper.prototype.request = function(command, params, callback) {

        var msg = { seq: 0, type: 'request', command: command };

        if (typeof callback == 'function')
            msg.seq = callbackHandler.wrap(callback);

        if (params)
            Object.keys(params).forEach( function(key) { msg[key] = params[key]; });

        var msg = "v8_" + JSON.stringify( msg );
        if(InspectorBackend.dumpV8ProtocolMessages)console.log( "V8.request " + msg );
        this._conn.send( msg );
    };

    V8Wrapper.prototype.close = function() { /*this._conn.end();*/ };

    V8Wrapper.prototype._parse = function ( message ) {
        if(InspectorBackend.dumpV8ProtocolMessages)console.log( "V8.response " + message );
        var obj = JSON.parse( message );

        if ( obj.type === 'response' && obj.request_seq > 0 ) {
            callbackHandler.processResponse( obj.request_seq, [obj] );

        } else if ( obj.type === 'event' ) {
            this.emit(obj.event, obj);
        }
    };
})();