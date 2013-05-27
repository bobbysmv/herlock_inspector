/**
 * ソケットっぽいInterfaceでデバイスのInspectorAgentsと接続
 * DebuggerAgentのみV8のメッセージをやり取りする。
 * ・agent_message JSON
 * ・v8_message "v8_" + JSON
 */
var NativeJSAgentSocket = function( host, port ) {
    this._ws = new WebSocket( "ws://"+host+":"+(port||8081) );
    var self = this;
    this._ws.onclose = function(){ self.onclose.apply(this,arguments); }
    this._ws.onerror = function(){ self.onerror.apply(this,arguments); }
    this._ws.onmessage = function(m){
        // v8?
        if(m.data.substr(0,3)==="v8_") return;

        //console.log( fmt(m.data) );
        self.onmessage.apply(this,arguments);
    }
    this._ws.onopen = function(){
        console.info("NativeJSAgentSocket opened");
        self.onopen.apply(this,arguments);
    }
}
NativeJSAgentSocket.prototype = {
    send: function (data) {
        //console.log(data);
        if( this._ws.send(data) !== true){ throw  new Error("NativeJSAgentSocket send failedinso"); };
    },
    close: function () {
        this._ws.close();
    },
    onclose:function(){},
    onerror:function(){},
    onmessage:function(){},
    onopen:function(){},
    get webSocket(){ return this._ws; }
}

function fmt( text ){
    if( text.length<200 ) return text;
    return text.substr(0,200)+"...";
};