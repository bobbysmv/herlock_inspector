(function(){

/**
 *　インスペクター自体のAgent
 * @constructor
 */
function InspectorAgent() {
    this.enabled = false;
}

InspectorAgent.prototype.enable = function(params, sendResult) {
    this.enabled = true;

    // TODO inspectorの有効無効をここで制御

    sendResult({result: this.enabled});
};

InspectorAgent.prototype.disable = function(params, sendResult) {
    this.enabled = false;

    // TODO inspectorの有効無効をここで制御

    sendResult({result: this.enabled});
};

devtools.inspector.InspectorAgent = InspectorAgent;



})();