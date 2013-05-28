window.ConsoleAgentCreate;
(function(){

    /**
     * create RemoteObject
     * @param {string} [className]
     * @param {string} [description]
     * @param {string} [objectId]
     * @param {string} [subtype] [ "array" , "date" , "node" , "null" , "regexp" ]
     * @param {string} type [ "boolean" , "function" , "number" , "object" , "string" , "undefined" ]
     * @param {*} [value]
     */
    var RemoteObject = function( className, description, objectId, subtype, type, value ){
        return { className:className, description:description, objectId:objectId, subtype:subtype, type:type, value:value };
    }

    /**
     * create CallFrame object.
     * @param {number} columnNumber JavaScript script column number.
     * @param {string} functionName JavaScript function name.
     * @param {number} lineNumber JavaScript script line number.
     * @param {string} url JavaScript script name or url.
     * @return {Object}
     */
    var CallFrame = function( columnNumber, functionName, lineNumber, url ){
        return { columnNumber:columnNumber, columnNumber:columnNumber, lineNumber:lineNumber, url:url };
    };

    /**
     * create ConsoleMessage object.
     * @param {string} level [ "debug" , "error" , "log" , "tip" , "warning" ] Message severity.
     * @param {number} [line] Line number in the resource that generated this message.
     * @param {string} [networkRequestId] Identifier of the network request associated with this message.
     * @param {array} [parameters] array of Runtime.RemoteObject  Message parameters in case of the formatted message.
     * @param {number} [repeatCount] Repeat count for repeated messages.
     * @param {string} [source] [ "console-api" , "html" , "javascript" , "network" , "other" , "wml" , "xml" ] Message source.
     * @param {object} [stackTrace] StackTrace JavaScript stack trace for assertions and error messages.
     * @param {string} [text] Message text.
     * @param {string} [type] [ "assert" , "dir" , "dirxml" , "endGroup" , "log" , "startGroup" , "startGroupCollapsed" , "trace" ] Console message type.
     * @param {string} [url] URL of the message origin.
     */
    var ConsoleMessage = function( level, line, networkRequestId, parameters, repeatCount, source, stackTrace, text, type, url ) {
        return { level:level, line:line, networkRequestId:networkRequestId, parameters:parameters, repeatCount:repeatCount, source:source, stackTrace:stackTrace, text:text, type:type, url:url };
    };


    /**
     *
     * 非v8依存
     * @param config
     * @return {*}
     * @constructor
     */
    ConsoleAgentCreate = function ( config ) {
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
                    var id = InspectorBackend.registerCallbackAndIssueId( "Console.enable", callback || empty );
                    sock.send( JSON.stringify({ id:id, method:"Console.enable", params:{} }) );
                }
            },
            disable:{
                value:function ( callback ) {
                    var id = InspectorBackend.registerCallbackAndIssueId( "Console.disable", callback || empty );
                    sock.send( JSON.stringify({ id:id, method:"Console.disable", params:{} }) );
                }
            },
            clearConsoleMessages:{
                value: function( callback ) {
                    var id = InspectorBackend.registerCallbackAndIssueId( "Console.clearConsoleMessages", callback || empty );
                    sock.send( JSON.stringify({ method:"Console.clearConsoleMessages", id:id, params:{} }) );
                }
            },

            // 以下Runtimeからの移植
            evaluate:{ // 非break時console上でスクリプト実行時に呼ばれる。v8に依存しない仕組みに。
                value: function( expression, objectGroup, includeCommandLineAPI, callback ) {
                    // objectGroup console, completion

                    function evaluateCallback ( error, result ) {
                        console.log( JSON.stringify( result ) );
                        callback(error, result);
                    }
                    var id = InspectorBackend.registerCallbackAndIssueId( "Console.evaluate", evaluateCallback );
                    sock.send( JSON.stringify({ id:id, method:"Console.evaluate", params:{
                        expression:expression, objectGroup:objectGroup, includeCommandLineAPI:includeCommandLineAPI
                    } }) );
                }
            },
            getProperties:{// 非break時console上でスクリプト実行時に呼ばれる。v8に依存しない仕組みに。
                value: function( objectId, ownProperties, callback ) {

                    function evaluateCallback ( error, result ) {
                        console.log( JSON.stringify( result ) );
                        callback(error, result);
                    }
                    var id = InspectorBackend.registerCallbackAndIssueId( "Console.getProperties", evaluateCallback );
                    sock.send( JSON.stringify({ id:id, method:"Console.getProperties", params:{
                        objectId:objectId, ownProperties:ownProperties, callback:callback
                    } }) );
                }
            }
        });
    };

})();
