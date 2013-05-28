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
    events.EventEmitter = function(){ this.__list = {}; };
    events.EventEmitter.prototype = {
        emit: function(){
            var name = arguments[0];
            if( !this.__list["on"+name] ) return;
            var args=[];
            for( var i=1; i < arguments.length; i++ ) args.push(arguments[i]);
            this.__list["on"+name].forEach( function(callback){ callback.apply( this, args );} );
        },
        on: function( name, func ){
            if( !("on"+name in this.__list) ) this.__list["on"+name] = [];
            this.__list["on"+name].push( func );
        }
    };

    /**
     * デバイスとやり取りするInspectorに対してのV8ラッパー
     *
     */
    window.V8Wrapper = function( njSocket ) {

        this._njSocket = njSocket;

        var self = this;
        this._njSocket.on("open", function() { self.emit('connect'); });
        this._njSocket.on('close', function() { self.emit('close'); });
        this._njSocket.on('error', function(e) { self.emit('error', e); console.info( "V8 error:"+e ); });
        this._njSocket.on("message", function(msg) {
            if( msg.data.substr(0,3) !== "v8_" )return;
            self._parse( msg.data.substr(3) );//"v8_"+JSON
        });

        Object.defineProperty(this,"connected",{ get:function(){ return this._njSocket.connected;} })

    };
    V8Wrapper.prototype = new events.EventEmitter();


    V8Wrapper.prototype.request = function(command, params, callback) {

        var msg = { seq: 0, type: 'request', command: command };

        if (typeof callback == 'function')
            msg.seq = callbackHandler.wrap(callback);

        if (params)
            Object.keys(params)
                .forEach( function(key) { msg[key] = params[key]; });

        var msg = "v8_" + JSON.stringify( msg );
        if(InspectorBackend.dumpV8ProtocolMessages)console.log( "V8.request " + msg );

        this._njSocket.send( msg );
    };

    V8Wrapper.prototype.close = function(){
        // TODO
    };

    V8Wrapper.prototype._parse = function ( message ) {
        if(InspectorBackend.dumpV8ProtocolMessages)console.log( "V8.response " + message );
        var obj = JSON.parse( message );

        if ( obj.type === 'response' && obj.request_seq > 0 )
            callbackHandler.processResponse( obj.request_seq, [obj] );
        else if ( obj.type === 'event' )
            this.emit(obj.event, obj); // 自身のEventとして送出
    };
})();