(function(){

function TimelineAgent( notify ) {
    this.notify = notify;
    this.enabled = false;

    this.maxCallStackDepth = 5;
    this.includeMemoryDetails = true;

    // @deprecated
    this.timer = null;
}

(function() {
    this.enable = function(params, sendResult) {
        this.enabled = true;
        sendResult({result: this.enabled})
    };

    this.disable = function(params, sendResult) {
        this.enabled = false;
        sendResult({});
    };

    this.eventRecorded = function(message) {

        var memory = app.memory;

        this.notify({
            method: "Timeline.eventRecorded",
            params: {
                record: {
                    startTime: Date.now(),
                    endTime: Date.now(),
                    data: { "message": message || "" },
                    type: "Memory",//"TimeStamp",
                    usedHeapSize: memory.used,
                    totalHeapSize: memory.total
                }
            }
        });
    };

    this.start = function(params, sendResult) {
        this.maxCallStackDepth = params && params.maxCallStackDepth || 5;
        sendResult({});
        this.notify({ method: "Timeline.started", params: {} });
        var self = this;
        this.timer = setInterval( function(){ self.eventRecorded(); }, 1000 );
    };

    this.stop = function(params, sendResult) {
        sendResult({});
        clearInterval( this.timer );
        var self = this;
        this.notify({ method: "Timeline.stopped", params: {} });
    };

    this.setIncludeMemoryDetails = function(params, sendResult) {
        this.includeMemoryDetails = params.enabled || true;
        sendResult({});
    };
}).call(TimelineAgent.prototype);



devtools.inspector.TimelineAgent = TimelineAgent;

})();