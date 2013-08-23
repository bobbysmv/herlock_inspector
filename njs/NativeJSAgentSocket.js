/**
 * ソケットっぽいInterfaceでデバイスのInspectorAgentsと接続
 * DebuggerAgentのみV8のメッセージをやり取りする。
 * ・agent_message JSON
 * ・v8_message "v8_" + JSON
 */
var NativeJSAgentSocket = function( host, port ) {

    this._ws = null;

    var self = this;

    var timer = -1;
    function tryConnecting(){
        if(timer!=-1 || this.isClosed)return;
        console.log(" ... ");
        timer = setTimeout( function(){
            if(ws){ ws.close(); ws = ws.onopen = ws.onclose = ws.onerror = ws.onmessage = null; }
            timer = -1;
            tryConnecting();
        }, 3000 );
        if(self._ws){ self._ws.close(); self._ws = self._ws.onopen = self._ws.onclose = self._ws.onerror = self._ws.onmessage = null; }
        var ws = new WebSocket( "ws://"+host+":"+(port||8081) );
        ws.onopen = function(){
            clearTimeout(timer);
            timer = -1;
            self._ws = this;
            flg = false;


            ws.onclose = function(){ self.onclose.apply(self,arguments); /*tryConnecting();*/ }
            ws.onerror = function(){ self.onerror.apply(self,arguments); /*tryConnecting();*/ }
            ws.onmessage = function(m){
                self.onmessage.apply(self,arguments);
                // v8?
                if(m.data.substr(0,3)==="v8_") return;
                self.onAgentMessage.apply(self,arguments);
            }
            self.onopen.apply(self,arguments);
        }
    }
    tryConnecting();

    Object.defineProperty(this,"connected",{ get:function(){
        return this._ws && this._ws.readyState === WebSocket.OPEN;
    } })
}
NativeJSAgentSocket.prototype = new window.events.EventEmitter();
NativeJSAgentSocket.prototype.send = function (data) {

    try{
        this._ws.send(data);
    } catch(e) {
        throw e;
    }

};
NativeJSAgentSocket.prototype.close = function () {
    this._ws.close();
    this.isClosed = true;
};
NativeJSAgentSocket.prototype.onclose = function(){ this.emit("close"); };
NativeJSAgentSocket.prototype.onerror = function(){ this.emit("error"); console.info("error"); };
NativeJSAgentSocket.prototype.onmessage = function(e){ this.emit("message",e); };
NativeJSAgentSocket.prototype.onAgentMessage = function(e){ this.emit("agentMessage",e); };
NativeJSAgentSocket.prototype.onopen = function(){
    this.emit("open");
};

function fmt( text ){
    if( text.length<200 ) return text;
    return text.substr(0,200)+"...";
}