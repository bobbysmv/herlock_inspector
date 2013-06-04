window.DOMAgentCreate;
(function(){

    /**
     *
     * 非v8依存
     * @param config
     * @return {*}
     * @constructor
     */
    DOMAgentCreate = function ( config ) {
        //var v8 = config.v8;
        var sock = config.njsSock;


        function sendEvent(name, data) {
            sock.onAgentMessage({ data: JSON.stringify( { method: "Console."+name, params: data||{} } ) });
        }

        function sendResponse(id, success, data) {
            sock.onAgentMessage({ data: JSON.stringify({ id:id, result: data||{} }) });
        }

        // Notifications
        function messageAdded( message ){
            // TODO
            console.log( JSON.stringify(message) );
            sendEvent( "messageAdded", message );
        };
        function messageRepeatCountUpdated( message ){
            // TODO
            sendEvent( "messageRepeatCountUpdated", message );
        };
        function messagesCleared( message ){
            // TODO
            sendEvent( "messagesCleared", message );
        };

        function empty(){};

        return Object.create( events.EventEmitter.prototype, {
            enable:{
                value:function ( callback ) {
                    var id = InspectorBackend.registerCallbackAndIssueId( "DOM.enable", callback || empty );
                    sock.send( JSON.stringify({ id:id, method:"DOM.enable", params:{} }) );
                }
            },
            disable:{
                value:function ( callback ) {
                    var id = InspectorBackend.registerCallbackAndIssueId( "DOM.disable", callback || empty );
                    sock.send( JSON.stringify({ id:id, method:"DOM.disable", params:{} }) );
                }
            },
            getDocument:{
                value: function( callback ) {
                    var id = InspectorBackend.registerCallbackAndIssueId( "DOM.getDocument", callback );
                    sock.send( JSON.stringify({ id:id, method:"DOM.getDocument", params:{} }) );
                }
            },
            cancelSearch:{
                value: function( callback ) {
                }
            },
            setSearchingForNode: {
                value: function( enabled, callback ) {
                    callback( enabled );
                }
            },
            resolveNode: {
                value: function( nodeId, callback ) {
                    var id = InspectorBackend.registerCallbackAndIssueId( "DOM.resolveNode", callback );
                    sock.send( JSON.stringify({ id:id, method:"DOM.resolveNode", params:{nodeId:nodeId} }) );
                }
            },
            highlightDOMNode: {
                value: function( nodeId, callback ) {
                    var id = InspectorBackend.registerCallbackAndIssueId( "DOM.highlightDOMNode", callback );
                    sock.send( JSON.stringify({ id:id, method:"DOM.highlightDOMNode", params:{nodeId:nodeId} }) );
                }
            }
        });
    };

})();
