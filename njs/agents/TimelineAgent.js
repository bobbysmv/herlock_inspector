/*
 * Copyright (C) 2009 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
WebInspector.TimelineAgent = {};
var RecordType =

WebInspector.TimelineAgent.RecordType = {
    EventDispatch: "EventDispatch",
    Layout: "Layout",
    RecalculateStyles: "RecalculateStyles",
    Paint: "Paint",
    ParseHTML: "ParseHTML",

    TimerInstall: "TimerInstall",
    TimerRemove: "TimerRemove",
    TimerFire: "TimerFire",

    XHRReadyStateChange: "XHRReadyStateChange",
    XHRLoad: "XHRLoad",
    EvaluateScript: "EvaluateScript",

    MarkTimeline: "MarkTimeline",
    MarkLoad: "MarkLoad",
    MarkDOMContent: "MarkDOMContent",

    ScheduleResourceRequest: "ScheduleResourceRequest",
    ResourceSendRequest: "ResourceSendRequest",
    ResourceReceiveResponse: "ResourceReceiveResponse",
    ResourceReceivedData: "ResourceReceivedData",
    ResourceFinish: "ResourceFinish",

    FunctionCall: "FunctionCall",
    GCEvent: "GCEvent",

    // SMV
    Memory:"Memory",
    Custom:"Custom"
};


window.TimelineAgentCreate;
(function(){
    /**
     *
     * 非v8依存
     * @param config
     * @return {*}
     * @constructor
     */
    TimelineAgentCreate = function ( config ) {
        //var v8 = config.v8;
        var sock = config.njsSock;


        function sendEvent(name, data) {
            sock.onAgentMessage({ data: JSON.stringify( { method: "Timeline."+name, params: data||{} } ) });
        }

        function sendResponse(id, success, data) {
            sock.onAgentMessage({ data: JSON.stringify({ id:id, result: data||{} }) });
        }

        // Notifications
        function eventRecorded( message ){
            // TODO
            sendEvent( "eventRecorded", message );
        };

        function empty(){};

        return Object.create( events.EventEmitter.prototype, {
            enable:{
                value:function ( callback ) {
                    var id = InspectorBackend.registerCallbackAndIssueId( "Timeline.enable", callback || empty );
                    sock.send( JSON.stringify({ id:id, method:"Timeline.enable", params:{} }) );
                }
            },
            disable:{
                value:function ( callback ) {
                    var id = InspectorBackend.registerCallbackAndIssueId( "Timeline.disable", callback || empty );
                    sock.send( JSON.stringify({ id:id, method:"Timeline.disable", params:{} }) );
                }
            },

            start:{
                value: function( maxCallStackDepth, callback ) {

                    var id = InspectorBackend.registerCallbackAndIssueId( "Timeline.start", callback||empty );
                    sock.send( JSON.stringify({ id:id, method:"Timeline.start", params:{
                        maxCallStackDepth: maxCallStackDepth
                    } }) );
                }
            },
            stop:{
                value: function( callback ) {
                    var id = InspectorBackend.registerCallbackAndIssueId( "Timeline.stop", callback||empty );
                    sock.send( JSON.stringify({ id:id, method:"Timeline.stop", params:{} }) );
                }
            },
            setIncludeMemoryDetails:{
                value: function( enabled, callback ) {

                    function _callback ( error, result ) {
                        Timeline.log( JSON.stringify( result ) );
                        callback(error, result);
                    }
                    var id = InspectorBackend.registerCallbackAndIssueId( "Timeline.setIncludeMemoryDetails", _callback );
                    sock.send( JSON.stringify({ id:id, method:"Timeline.setIncludeMemoryDetails", params:{ enabled: enabled } }) );
                }
            },
            RecordType:{
                value: function(){ return RecordType }
            }
        });
    };

})();
