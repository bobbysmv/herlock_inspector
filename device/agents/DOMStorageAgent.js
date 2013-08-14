(function(){


/**
 * DOMStorageAgent
 * @constructor
 */
function DOMStorageAgent( notify ) {
    this.notify = notify;
    this._enabled = false;

    this.storages = [];
};

(function(){

    this.notifyAddDOMStorage = function( storage ) {
        this.notify({ method: 'DOMStorage.addDOMStorage', params: { storage: storage }});
    };
    this.notifyUpdateDOMStorage = function( storageId ) {
        this.notify({ method: 'DOMStorage.updateDOMStorage', params: { storageId: storageId }});
    };

    this.enable = function(params, sendResult) {
        this._enabled = true;
        sendResult( {result: this._enabled} );
        if( !this._enabled ) return;

        // TODO Event addStorage
        this.storages.push(localStorage);
        this.notifyAddDOMStorage( { id: this.storages.indexOf(localStorage), host: location.host, isLocalStorage: true } );
    };

    this.disable = function(params, sendResult) {

    };


    this.getDOMStorageEntries = function(params, sendResult) {
        var storage = this.storages[ params.storageId ];
        var entries = [];
        var len = storage.length;
        for( var i = 0; i < len; i++ ) {
            var k = storage.key(i);
            var v = storage.getItem(k);
            entries.push( [k,v] );
        }

        sendResult( {entries:entries} );
    };
    this.setDOMStorageItem = function(params, sendResult) {
        var storage = this.storages[ params.storageId ];
        try{
            storage.setItem( params.key, params.value );
        } catch(e) {
            sendResult( {success:false} );
            return;
        }
        sendResult( {success:true} );
    };
    this.removeDOMStorageItem = function(params, sendResult) {
        var storage = this.storages[ params.storageId ];
        try{
            storage.removeItem( params.key );
        } catch(e) {
            sendResult( {success:false} );
            return;
        }
        sendResult( {success:true} );
    };

}).call(DOMStorageAgent.prototype);


devtools.inspector.DOMStorageAgent = DOMStorageAgent;

})();