window.DOMStorageAgentCreate;
(function(){

    /**
     * v8依存
     * @param config
     * @return {*}
     * @constructor
     */
    DOMStorageAgentCreate = function ( config ) {
        var v8 = null,
            sock = null,
        //map from sourceID to filename
            sourceIDs = {},
        //milliseconds to wait for a lookup
            LOOKUP_TIMEOUT = 2500,
        //node function wrapper
            FUNC_WRAP = /^\(function \(exports, require, module, __filename, __dirname\) \{ ([\s\S]*)\n\}\);$/,


        sock = config.njsSock;
        //v8 = config.v8;


        function sendEvent(name, data) {
            data = data || {};
            if (sock) {
                sock.onmessage({
                    data: JSON.stringify({
                        method: "Debugger."+name,
                        params: data
                    })
                });
            }
        }

        function sendResponse(id, success, data) {
            data = data || {};
            if (sock) {
                // TODO
                sock.onmessage({
                    data: JSON.stringify({
                        id:id,
                        result: data
                    })
                });
            }
        }

        function empty(){};

        return Object.create( events.EventEmitter.prototype, {
            enable:{
                value:function (callback) {
                    var id = InspectorBackend.registerCallbackAndIssueId( "DOMStorage.enable", callback || empty );
                    sock.send( JSON.stringify({ id:id, method:"DOMStorage.enable", params:{} }) );
                }
            },
            disable:{
                value:function (callback) {
                    var id = InspectorBackend.registerCallbackAndIssueId( "DOMStorage.disable", callback || empty );
                    sock.send( JSON.stringify({ id:id, method:"DOMStorage.disable", params:{} }) );
                }
            },
            getDOMStorageEntries:{
                value: function( storageId, callback ) {
                    var id = InspectorBackend.registerCallbackAndIssueId( "DOMStorage.getDOMStorageEntries", callback );
                    sock.send( JSON.stringify({ id:id, method:"DOMStorage.getDOMStorageEntries", params:{storageId:storageId} }) );
                }
            },
            setDOMStorageItem:{
                value: function( storageId, key, value, callback ) {
                    var id = InspectorBackend.registerCallbackAndIssueId( "DOMStorage.setDOMStorageItem", callback );
                    sock.send( JSON.stringify({ id:id, method:"DOMStorage.setDOMStorageItem", params:{storageId:storageId, key:key, value:value} }) );
                }
            },
            removeDOMStorageItem:{
                value: function( storageId, key, callback ) {
                    var id = InspectorBackend.registerCallbackAndIssueId( "DOMStorage.removeDOMStorageItem", callback );
                    sock.send( JSON.stringify({ id:id, method:"DOMStorage.removeDOMStorageItem", params:{storageId:storageId, key:key} }) );
                }
            }
        });
    };

})();
