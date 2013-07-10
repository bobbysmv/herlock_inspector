/*

 payload.id;
 payload.nodeType;
 payload.nodeName;
 payload.localName;
 payload.nodeValue;
 if (payload.attributes)
 payload.childNodeCount;
 if (payload.children)
 if (this._nodeType === Node.ELEMENT_NODE) {
    if (payload.documentURL)
 } else if (this._nodeType === Node.DOCUMENT_TYPE_NODE) {
     payload.publicId;
     payload.systemId;
     payload.internalSubset;
 } else if (this._nodeType === Node.DOCUMENT_NODE) {
    payload.documentURL;
 } else if (this._nodeType === Node.ATTRIBUTE_NODE) {
     payload.name;
     payload.value;

 */

(function(){

    var inspector = devtools.inspector;

    Node = { ELEMENT_NODE: 1, DOCUMENT_NODE: 9, ATTRIBUTE_NODE:2 };


    function DOMAgent( notify ) {
        this.notify = notify;
        this.enabled = false;

        this.highlightObject = null;
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

        this.getDocument = function(params, sendResult) {
            sendResult( { root:windowToNode() } );
        };

        this.resolveNode = function(params, sendResult) {
            var remoteObject = inspector.getAgent("Runtime").getRemoteObjectById(params.nodeId);
            sendResult( { object: remoteObject || {} } );
        };

        this.highlightDOMNode = function(params, sendResult) {
            if( this.highlightObject ) {
                var object = this.highlightObject;
                if( object.transform && object.transform.colorTransform ) // DisplayObject
                    object.transform.colorTransform = object.__ct_backup;
                this.highlightObject = null;
            }

            this.highlightObject = inspector.getAgent("Runtime").getObjectByRemoteId(params.nodeId);
            var object = this.highlightObject;
            if( object.transform && object.transform.colorTransform ) {
                // DisplayObject
                object.__ct_backup = object.transform.colorTransform;
                var newCt = new ColorTransform( 1.4,1.4,1.0, 0.7, 20, 20 );
                newCt.concat( object.transform.colorTransform );
                object.transform.colorTransform = newCt;
            }
            // TODO
            sendResult( { } );
        };

        this.getEventListenersForNode = function(params, sendResult){
            params.nodeId;

            var listener = {nodeId:nodeId,type:type,listenerBody:listenerBody,sourceName:sourceName,lineNumber:lineNumber}
            // TODO
            sendResult( { listeners:[] } );
        }


    }).call(DOMAgent.prototype);



    /**
     *
     *
     *
     * @return {Object}
     */
    function windowToNode(){
        var layers = [];
        var i = 0;
        while( getLayerAt(i) ) {
            layers.push( getLayerAt(i).toNode() );i++;
        }

        var remote = inspector.getAgent("Runtime").wrapObject( window, "DOM" );

        var node = {
            id : remote.objectId,
            nodeType : Node.ELEMENT_NODE,
            nodeName : "Window",
            localName : "Window",
            nodeValue : "",
            attributes : [],
            childNodeCount : layers.length,
            children : layers,
            documentURL : location.href
        };
        return {
            id : "",
            nodeType : Node.DOCUMENT_NODE,
            nodeName : "Window",
            localName : "Window",
            nodeValue : "",
            attributes : [],
            childNodeCount : 1,
            children : [node],
            documentURL : location.href
        };
    }
    Layer.prototype.toNode = function(){
        var remote = inspector.getAgent("Runtime").wrapObject( this, "DOM" );

        return {
            id : remote.objectId,
            nodeType : Node.ELEMENT_NODE,
            nodeName : "Layer",
            localName : "Layer",
            nodeValue : "",
            attributes : [],
            childNodeCount : this.content? 1: 0,
            children : this.content
                && this.content.toNode
                ? [this.content.toNode()]
                : []
        }
    };
    DisplayObject.prototype.toNode = function(){
        var remote = inspector.getAgent("Runtime").wrapObject( this, "DOM" );
        return {
            id : remote.objectId,
            nodeType : Node.ELEMENT_NODE,
            nodeName : "DisplayObject",
            localName : "DisplayObject",
            nodeValue : "",
            attributes : this.name? [ "name", this.name ] : [],
            childNodeCount : 0,
            children : []
        }
    };
    Bitmap.prototype.toNode = function(){
        var node = DisplayObject.prototype.toNode.call(this);
        node.nodeName = node.localName = "Bitmap";
        node.childNodeCount = this.bitmapData ? 1: 0;
        node.children = this.bitmapData ? [ this.bitmapData.toNode() ]: [];
        return node;
    };
    BitmapData.prototype.toNode = function(){
        var remote = inspector.getAgent("Runtime").wrapObject( this, "DOM" );
        return {
            id : remote.objectId,
            nodeType : Node.ELEMENT_NODE,
            nodeName : "BitmapData",
            localName : "BitmapData",
            nodeValue : "",
            attributes : [ "width", ""+this.width, "height", ""+this.height ],
            childNodeCount : 0,
            children : []
        };
    };
    TextField.prototype.toNode = function(){
        var node = DisplayObject.prototype.toNode.call(this);
        node.nodeName = node.localName = "TextField";
        node.nodeValue = this.text;
        return node;
    };
    DisplayObjectContainer.prototype.toNode = function(){
        var node = DisplayObject.prototype.toNode.call(this);
        node.nodeName = node.localName = "DisplayObjectContainer";
        var children = [];
        var i = 0;
        while( this.getChildAt(i) ) {
            children.push( this.getChildAt(i).toNode() );i++;
        }
        node.childNodeCount = children.length;
        node.children = children;
        return node;
    };
    Stage.prototype.toNode = function(){
        var node = DisplayObjectContainer.prototype.toNode.call(this);
        node.nodeName = node.localName = "Stage";
        node.attributes.push( "frameRate", ""+this.frameRate );
        return node;
    };
    Sprite.prototype.toNode = function(){
        var node = DisplayObjectContainer.prototype.toNode.call(this);
        node.nodeName = node.localName = "Sprite";
        return node;
    };

    TinyGL.prototype.toNode = function(){
        var remote = inspector.getAgent("Runtime").wrapObject( this, "DOM" );

        return {
            id : remote.objectId,
            nodeType : Node.ELEMENT_NODE,
            nodeName : "TinyGL",
            localName : "TinyGL",
            nodeValue : "",
            attributes : [],
            childNodeCount : 0,
            children : []
        }
    };


});
