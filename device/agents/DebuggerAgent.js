/**
 * DebuggerAgent
 * @constructor
 */
function DebuggerAgent( notify ) {
    this.notify = notify;
    this._enabled = false;
};

(function(){


    this.enable = function(params, sendResult) {
        this._enabled = app.isANDROID? true: false;
        sendResult( {result: this._enabled} );
        if( !this._enabled ) return;

        this.notify( { method: "Debugger.debuggerWasEnabled", param: {} });
    };

    this.disable = function(params, sendResult) {

    };

}).call(DebuggerAgent.prototype);

