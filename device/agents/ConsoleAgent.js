
function formatedString(  ) {
    var r = "";
    var len = arguments.length;
    for( var i=0; i < len; i++ ) r+= ", " + arguments[i]
    return r.substr(2);
}

function ConsoleAgent( notify ) {
    this.notify = notify;
    this.enabled = false;
    this.messages = [];

    var nativeConsole = console;
    var self = this;

    [ 'log', 'warn', 'info', 'error', 'dir'].forEach( function(level) {
        var ref = console[level];
        if(!ref)return;
        console[level] = ( function(){
            ref.apply( nativeConsole, arguments);

            var message = {
                method: 'Console.messageAdded',
                params: {
                    message: {
                        text: formatedString.apply(self,arguments),
                        level: level == 'warn' ? 'warning' : level,
                        source: 'console-api'
                    }
                }
            };

            //TODO make it aware of RemoteObjects so 
            //that the console in the frontend can show us its shinny 
            //dropdown
            /*if (level == 'dir') {
             message.params.message.type = level;
             }*/

            //TODO save messages when this agent is disabled.
            self.messages.push(message);
            //nativeConsole.log("Console.messageAdded");

            notify(message,false);
        } );
    });

    //
    this.objects = {};

}

(function() {
    this.enable = function(params, sendResult) {
        this.enabled = true;
        sendResult({result: this.enabled});
        // ?
        for(var i = 0, len = this.messages.length; i < len; i++)
            this.notify(this.messages[i]);
    };

    this.disable = function(params, sendResult) {
        this.enabled = false;
        sendResult({});
    };

    this.clearConsoleMessages = function(params, sendResult) {
        console.log("Console.clearConsoleMessages");
        this.messages = [];
        sendResult({});

        // TODO Console 連携
        this.notify({method: 'Console.messagesCleared'},false);
    };

    // Console上でのscript実行

    this.evaluate = function(params, sendResult) {
        // 委譲
        inspector.getAgent("Runtime").evaluate( params, sendResult );
    };
    this.getProperties = function(params, sendResult) {
        // 委譲
        inspector.getAgent("Runtime").getProperties( params, sendResult );
    };


/*
    this.setMonitoringXHREnabled = function(params, sendResult) {
        sendResult({});
    };
*/
/*
    this.addInspectedHeapObject = function(params, sendResult) {
        sendResult({});
    };

*/
}).call( ConsoleAgent.prototype );

//module.exports = ConsoleAgent;

