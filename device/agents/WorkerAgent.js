
function WorkerAgent () {

}
WorkerAgent.prototype = {
    enable: function(params, sendResult) {
        sendResult({result: true});
    }
};