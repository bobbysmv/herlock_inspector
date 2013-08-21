(function(){

    var ns = devtools.internal;

    var View = ns.View;

    var MODE_OEF = true;

    var FLICK_FILTER = 0.04;

    var State = {
        WAIT : 'wait'
        , MANUAL : 'manual'
        , AUTO_OPEN : 'auto_open'
        , AUTO_CLOSE : 'auto_close'
    };
    devtools.internal.PullHandle = ns.Class( View, {

        initialize: { value: function( context ){
            View.prototype.initialize.apply( this, arguments );

            // view
            this.bg = this.container.addChild( ns.artwork.handle_bg );
            this.symbol = this.container.addChild( ns.artwork.handle_symbol );
            this.bg.x = -this.bg.width;
            this.bg.y = -this.bg.height/2;
            this.bg.alpha = 0.3;
            this.symbol.x = -this.symbol.width;
            this.symbol.y = -this.symbol.height/2;
            this.symbol.alpha = 0.6;

            this.state = State.WAIT;

            // display
            this.offsetPercent = 1.0;


            // area
            this.area = { offset:0, size:100 };


            // touch
            this.tracking = { prevTouch:null, vec: {x:0, y:0}, ave: null, onScreen: false };

            // event
            this._onTouchBegin = function(e){ self.__onTouchBegin(e); };
            this._onTouch = function(e){ self.__onTouch(e); };

            var self = this;
            this.container.addEventListener( 'touchBegin', this._onTouchBegin );
            this.context.listen( "enterFrame", function(){ self.notifyEnterFrame();} );


            // callback
            this.onChangeValue = null;
            this.onChangeState = null;
            this.onFlickToRight = null;
            this.onTouchBegin = null;
            this.onTouchEnd = null;
        }},

        setArea:{ value: function( offset, size ) {
            this.area = { offset:offset, size:size };

        }},

        getState:{ value: function(){ return this.state; }},
        _setState:{ value: function( state ) {
            if( this.state === state ) return;
            this.state = state;
            //console.log("state : "+state);
            if( this.onChangeState ) this.onChangeState( state );

            // wait for closing
            /*
            if( this.state == State.WAIT && this.offsetPercent == 0 )
                this.context.stage.addEventListener( 'touchBegin', this._onTouchBegin);
            else
                this.context.stage.removeEventListener( 'touchBegin', this._onTouchBegin);
            */
        }},

        listenScreenTouch:{ value: function(){
            this.context.stage.addEventListener( 'touchBegin', this._onTouchBegin);
        }},

        unlistenScreenTouch:{ value: function(){
            //console.log( "unlistenScreenTouch" );
            this.context.stage.removeEventListener( 'touchBegin', this._onTouchBegin);
        }},

        __onTouchBegin:{ value: function(e){
            e.stopPropagation();
            //console.log("onTouchBegin");
            this._setState( State.MANUAL );

            var self = this;
            window.addEventListener( 'touchmove', this._onTouch );
            window.addEventListener( 'touchend', this._onTouch );
            window.addEventListener( 'touchcancel', this._onTouch );
            this.tracking.vec = {x:0, y:0};
            this.tracking.ave = null;
            this.tracking.prevTouch = null;//{ x: t.x, y: t.y };

            this.tracking.onScreen = true;

            if( this.onTouchBegin ) this.onTouchBegin();
        }},

        __onTouch:{ value: function(e){
            var t = e.changedTouches.item(0);

            //console.log(e);

            switch( e.type ) {
                /*
                case 'touchstart':
                    this._setState( State.MANUAL );
                    var self = this;
                    window.addEventListener( 'touchmove', this._onTouch );
                    window.addEventListener( 'touchend', this._onTouch );
                    window.addEventListener( 'touchcancel', this._onTouch );
                    this.tracking.vec = {x:0, y:0};
                    this.tracking.ave = null;
                    this.tracking.prevTouch = null;//{ x: t.x, y: t.y };
                    this.tracking.onScreen = true;
                    break;
                */
                case 'touchmove':
                    if( this.tracking.prevTouch == null)
                        this.tracking.prevTouch = { x: t.x, y: t.y };
                    this.tracking.vec.x += t.x - this.tracking.prevTouch.x;
                    this.tracking.vec.y += t.y - this.tracking.prevTouch.y;
                    this.tracking.prevTouch = { x: t.x, y: t.y };

                    if( !MODE_OEF ){

                        // touch
                        if( this.tracking.ave == null )
                            this.tracking.ave = { x:this.tracking.vec.x, y:this.tracking.vec.y };
                        //
                        this.tracking.ave.x = this.tracking.ave.x/2 + this.tracking.vec.x/2;
                        this.tracking.ave.y = this.tracking.ave.y/2 + this.tracking.vec.y/2;

                        var tmp = this.offsetPercent;
                        tmp += this.tracking.vec.x / this.area.size;
                        tmp = tmp>1? 1: tmp<0? 0: tmp;


                        this.tracking.vec = {x:0,y:0};

                        if( this.offsetPercent == tmp ) break;


                        if( this.onChangeValue ) {
                            if( this.onChangeValue( this.offsetPercent ) )
                                this.offsetPercent = tmp;
                        }
                    }
                    break;
                case 'touchend':
                case 'touchcancel':

                    //
                    window.removeEventListener( 'touchmove', this._onTouch );
                    window.removeEventListener( 'touchend', this._onTouch );
                    window.removeEventListener( 'touchcancel', this._onTouch );

                    if( this.tracking.prevTouch!=null ) {
                        this.tracking.vec.x += t.x - this.tracking.prevTouch.x;
                        this.tracking.vec.y += t.y - this.tracking.prevTouch.y;
                    }

                    if( this.tracking.ave == null )
                        this.tracking.ave = { x:this.tracking.vec.x, y:this.tracking.vec.y };

                    this.tracking.ave.x = this.tracking.ave.x/2 + this.tracking.vec.x/2;
                    this.tracking.ave.y = this.tracking.ave.y/2 + this.tracking.vec.y/2;

                    var prev = this.state;
                    this._setState( State.WAIT );

                    if( prev === State.MANUAL  ) {
                        var flickValue = this.tracking.ave.x / Math.min( window.innerWidth, window.innerHeight );
                        //console.log( flickValue , this.tracking.vec.x );
                        if( flickValue < -FLICK_FILTER ) {
                            if( this.onFlickToLeft ) this.onFlickToLeft();
                        } else if( flickValue > FLICK_FILTER ) {
                            if( this.onFlickToRight ) this.onFlickToRight();
                        }
                    }

                    //
                    this.tracking.onScreen = false;
                    this.tracking.prevTouch = null;

                    if( this.onTouchEnd ) this.onTouchEnd();

                    break;
            }
        }},

        open: { value: function(){ // TODO this.offsetPercentと実値の際により動かないケースがある
            if( this.offsetPercent === 0 || this.state === State.AUTO_OPEN ) return;
            //console.log(" handle.open");
            this._setState( State.AUTO_OPEN );
        }},

        close: { value: function(){ // TODO this.offsetPercentと実値の際により動かないケースがある
            if( this.offsetPercent === 1 || this.state === State.AUTO_CLOSE ) return;
            //console.log(" handle.close");
            this._setState( State.AUTO_CLOSE );
        }},

        notifyEnterFrame:{ value:function( e ){
            //console.log( "notifyEnterFrame: "+this.state );
            switch( this.state ) {
                case State.AUTO_OPEN:
                    this.offsetPercent += (0-this.offsetPercent)*0.3;
                    //console.log( "op offset " + this.offsetPercent );
                    if( this.offsetPercent<=0.005 ){
                        this.offsetPercent = 0;
                        this._setState( State.WAIT );
                    }
                    if( this.onChangeValue )
                        this.onChangeValue( this.offsetPercent );

                    break;

                case State.AUTO_CLOSE:
                    this.offsetPercent += (1-this.offsetPercent)*0.3;
                    //console.log( "op offset " + this.offsetPercent );
                    if( this.offsetPercent > (1-0.005) ){
                        this.offsetPercent = 1;
                        this._setState( State.WAIT );
                    }
                    if( this.onChangeValue )
                        this.onChangeValue( this.offsetPercent );
                    break;

                case State.MANUAL:

                    if( MODE_OEF ){

                        // touch
                        if( this.tracking.ave == null )
                            this.tracking.ave = { x:this.tracking.vec.x, y:this.tracking.vec.y };

                        //
                        this.tracking.ave.x = this.tracking.ave.x/2 + this.tracking.vec.x/2;
                        this.tracking.ave.y = this.tracking.ave.y/2 + this.tracking.vec.y/2;

                        var tmp = this.offsetPercent;
                        tmp += this.tracking.vec.x / this.area.size;
                        //
                        tmp = tmp>1? 1: tmp<0? 0: tmp;

                        //
                        this.tracking.vec = {x:0,y:0};

                        //
                        if( this.offsetPercent == tmp ) break;

                        //
                        if( this.onChangeValue ) {
                            if( this.onChangeValue( this.offsetPercent ) )
                                this.offsetPercent = tmp;
                        }
                    }

                    break;
            }

        }},

        resize: { value: function( width, height ){
            View.prototype.resize.apply( this, arguments );

            // TODO Touch中の拡大処理と辻褄をどう合わせるのか？
            this.container.width = width;
            this.container.height = height;

            return this;
        }}
    });

    devtools.internal.PullHandle.State = State;

})();