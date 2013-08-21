(function(){

    if( !devtools.internal ) devtools.internal = {};
    var ns = devtools.internal;


    ns.createCircularBuffer = function( length, def ){
        var cursor = 0, buffer = new Array(length);
        buffer.__proto__ = null;
        for( var i = 0; i < length; i++ ) buffer[i] = def || 0;
        return {
            get  : function( index ) { return buffer[ ( cursor + index ) % length ]; },
            push : function( item ) {
                buffer[ cursor ] = item;
                cursor = (length + cursor + 1) % length;
            },
            length: length
        };
    };

    ns.Class = function( parent, impl ){
        var cls = function(){ this.initialize.apply(this,arguments); };
        cls.prototype = Object.create( parent.prototype, impl );
        return cls;
    };

    ns.Context = ns.Class( Object, {

        initialize: { value: function(){
            this._messageListeners = {};
        }},

        message: { value: function( message, argument ) {
            if( !(message in this._messageListeners) ) return;
            var listeners = this._messageListeners[message];
            for( var i = 0, len = listeners.length; i < len; i++ )
                listeners[i]( argument );
        }},

        listen: { value: function( message, listener ) {
            if( !(message in this._messageListeners) ) this._messageListeners[message] = [];
            this._messageListeners[message].push(listener);
        }},

        unlisten: { value: function( message, listener ) {
            if( !(message in this._messageListeners) ) return;
            var index = this._messageListeners[message].indexOf(listener);
            if( index == -1 ) return;
            this._messageListeners[message].splice( index, 1 );
        }}

    });


    var nativeConsoleLog = console.log;
    var nativeOnUncaughtError = window.onUncaughtError;



    ns.InspectorView = ns.Class( ns.Context, {

        initialize: { value: function() {
            ns.Context.prototype.initialize.call(this);

            // display
            this._stage = new Stage( 100,100 );
            this._container = this._stage.addChild( new Sprite() );
            this._container.name = "container";
            this._layer = new Layer( this._stage );
            window.addLayer( this._layer );

            // tiny
            this._tiny = new TinyGL( 100,100 );
            this._tinyLayer = new Layer( this._tiny );

            //
            /*
            this._bg = this.container.addChild( ns.artwork.black );
            this._bg.alpha = 0.7;
            */
            this._bg = new TinyGLRectangle().addTo( this._tiny).colors(0xb2000000);


            this._border = this.container.addChild( ns.artwork.black );
            this._border.alpha = 0.5;

            // view
            this._mainPanel = new ns.MainPanel( this).addTo( this.container );
            this._subPanel = new ns.SubPanel( this ).addTo( this.container );
            this._handle = new ns.PullHandle( this ).addTo( this.container );

            this.mainPanel.hide();
            this.subPanel.hide();


            // listeners
            this._onOrientationChange = null;
            this._onEnterFrame = null;

            // flags
            this._isShown = false;
            this._visible = true;

            //
            this._offset = 0;


            // prepare..
            var self = this;
            console.log = function(){ self.log.apply( self, arguments ); };
            window.onUncaughtError = function(){ self._onUncaughtError.apply( self, arguments );};

            //
            this._handle.onChangeValue = function(value){
                // filter openedなら都度の操作を無視。flickでのみ動作させる
                if( self.offset == 0 && self._handle.getState() === ns.PullHandle.State.MANUAL ) return false;

                self.offset = value;
                if( self._handle.getState() === ns.PullHandle.State.WAIT && value == 1 ) self.hide();
                return true;
            };
            this._handle.onChangeState = function(state){
                if( state !== ns.PullHandle.State.WAIT ) self.show();
                if( state == ns.PullHandle.State.WAIT && this.offsetPercent == 0 )
                    this.listenScreenTouch();
            };
            this._handle.onFlickToLeft = function(){
                //console.log("inspector.onFlickToLeft");
                this.open();
            };
            this._handle.onFlickToRight = function(){
                //console.log("onFlickToRight");
                this.close();
                this.unlistenScreenTouch();
            };
            this._handle.onTouchBegin = function(){
                // view
                this.symbol.alpha = 0.8;
                this.bg.alpha = 0.7;
                this.bg.scaleX = this.bg.scaleY = 1.2;
                this.symbol.x = -this.symbol.width;
                this.symbol.y = -this.symbol.height/2;
                this.bg.x = -this.bg.width;
                this.bg.y = -this.bg.height/2;
            };
            this._handle.onTouchEnd = function(){
                //console.log("onTouchEnd");
                if( this.state === ns.PullHandle.State.WAIT && self.offset!=0 ) {
                    this.offsetPercent > 0.5? this.close(): this.open();
                }
                // view
                this.symbol.alpha = 0.6;
                this.bg.alpha = 0.3;
                this.bg.scaleX = this.bg.scaleY = 1.0
                this.symbol.x = -this.symbol.width;
                this.symbol.y = -this.symbol.height/2;
                this.bg.x = -this.bg.width;
                this.bg.y = -this.bg.height/2;
            };

            // TODO 最前列へ常に表示
            window.addEventListener("added", function(e){
                //console.log("to front");
                window.removeEventListener( "added", arguments.callee );
                window.addLayer( self._tinyLayer );
                window.addLayer( self._layer );
                self.message("changeLayerDepth");
                window.addEventListener( "added", arguments.callee );
            });

            //
            window.addEventListener( 'orientationchange', ( this._onOrientationChange = function(){ setTimeout(function(){self._layOut();},1000); } ) );
            this._stage.addEventListener( 'enterFrame',( this._onEnterFrame = function(e){ self._sendEnterFrameMessage(e); } ) );

            // init
            setTimeout(function(){ self._layOut(); self.offset = 1.0; }, 0 );

        }},

        tiny: { get: function(){ return this._tiny; } },

        stage: { get: function(){ return this._stage; } },

        container: { get: function(){ return this._container; } },

        mainPanel: { get: function(){ return this._mainPanel; } },

        subPanel: { get: function(){ return this._subPanel; } },

        orientationIsHorizontal:{
            get:function(){ return (window.innerWidth > window.innerHeight) }
        },

        /**
         * 0.0 〜 1.0
         */
        offset:{
            get:function(){ return this._offset; },
            set:function( val ){
                /*
                if( val < 1.0 ) this.show();
                else this.hide();
                */
                this._offset = val;
                this._tinyLayer.offsetX = val;
                this.container.x = this._stage.stageWidth * val;

                this.message( "changeOffset", val );
            }
        },

        isShown: {
            get:function(){ return this._isShown; }
        },

        show: { value: function(){
            if( this.isShown ) return;
            this._isShown = true;
            //console.log("show");
            // show
            window.addLayer( this._layer );
            window.addLayer( this._tinyLayer );
            this.mainPanel.show();
            this.subPanel.show();
            // events
            var self = this;
            //window.addEventListener( 'orientationchange', ( this._onOrientationChange = function(){ setTimeout(function(){self._layOut();},1000); } ) );
            //this._stage.addEventListener( 'enterFrame',( this._onEnterFrame = function(e){ self._sendEnterFrameMessage(e); } ) );

            this._layOut();
        }},

        hide: { value: function(){
            if( !this.isShown ) return;
            this._isShown = false;
            //console.log("hide");
            // hide
            window.removeLayer( this._tinyLayer );
            this.mainPanel.hide();
            this.subPanel.hide();
            // events
            //window.removeEventListener( 'orientationchange', this._onOrientationChange );
            //this._stage.removeEventListener( 'enterFrame', this._onEnterFrame );
            //this._onOrientationChange = null;
        }},

        visible: {
            get:function(){ return this._visible;},
            set:function( value ){
                if( this._visible == value ) return;
                this._visible = value;
                if( this._visible ) {
                    this.show();
                    window.addLayer( this._layer );
                } else {
                    this.hide();
                    window.removeLayer( this._layer );
                }
            }
        },

        log:{ value: function(){
            // TODO 美しくない
            this.mainPanel._logView.log.apply( this.mainPanel._logView, arguments )
            //this.message( "log", arguments );
            nativeConsoleLog.apply( console, arguments );
        }},

        _sendEnterFrameMessage:{ value:function(e){
            //console.log("_sendEnterFrameMessage");
            this.message( "enterFrame" );
        }},


        _onUncaughtError:{ value: function(e){
            this.message( "error", e );
            this.show();
            nativeOnUncaughtError.apply( window, arguments );
        }},

        _layOut: { value: function(){
            // offsetとの連動
            //  "offset"プロパティはcontainerと連動Layerのオフセット管理 layOut内で行われる処理はcontainer内での座標調整となる
            //
            var width;
            var height;

            var globalPoint = this.container.localToGlobal( new Point(0,0) );


            if( this.orientationIsHorizontal ) {
                // 横向き
                var width = 640 * ( window.innerWidth / window.innerHeight ) * 2/3;
                var height = 640 * 2/3;

                this._tiny.width = this._stage.stageWidth = width;
                this._tiny.height = this._stage.stageHeight = height;
//                this._bg.width = width;
//                this._bg.height = height;
                this._bg.tl( 0,0).br(width, height);

                var borderWidth = 3;

                this.mainPanel.offset(0,0).resize( height-25, height );
                this._border.x = height-25;
                this._border.width = borderWidth;
                this._border.height = height;
                this._border.visible = true;

                this.subPanel.offset( height-25 + borderWidth, 0 ).resize( width - (height-25 + borderWidth), height );
                this._handle.offset( 0, height/2 );

                this._handle.setArea(0, window.innerWidth);
            } else {
                // 縦向き
                var width = 640 * 2/3;
                var height = 640 * ( window.innerHeight / window.innerWidth ) * 2/3;

                this._tiny.width = this._stage.stageWidth = width;
                this._tiny.height = this._stage.stageHeight = height;
                this._bg.width = width;
                this._bg.height = height;
                this._bg.tl( 0,0).br(width, height);

                this.mainPanel.offset(0,0).resize( width, width+25 );

                this._border.visible = false;

                this.subPanel.offset( 0, width+25 ).resize( width, height-(width+25) );
                this._handle.offset( 0, height/2 );

                this._handle.setArea(0, window.innerWidth);
            }

            this.offset = this.offset;
        }}
    });

    // start
    setTimeout( function(){
        devtools.view = new ns.InspectorView();
    }, 0 );

})();
