(function(){

    var ns = devtools.internal;
    var View = devtools.internal.View;

    devtools.internal.LogView = devtools.internal.Class( View, {

        initialize: { value: function( context ){
            View.prototype.initialize.call(this, context);
            this.container.name = "log_view";

            // display
            this.tfs = [];
            this.fmts = {
                error: new TextFormat( null, 15, 0xff0000 ),
                log: new TextFormat( null, 12, 0xffffff )
            };
            this.container.mask = this.container.addChild( new Bitmap( new BitmapData(1,1,true, 0xffff0000) ) );
            this.container.mask.visible = false;

            this.container.hitArea = this.container.addChild( new Bitmap( new BitmapData(1,1,true, 0xffff0000) ) );
            this.container.hitArea.alpha = 0;
            this.container.hitArea.name = "hitArea";

            this._clearBtn = new ns.ButtonView().addTo( this.container );
            var clearBmp = this._clearBtn.container.addChild( ns.artwork.eraser );
            clearBmp.x = -clearBmp.width / 2;
            clearBmp.y = -clearBmp.height / 2;

            this._clearBtn.container.scaleX = this._clearBtn.container.scaleY = 0.8;

            // tiny
            this._lines = new TinyGLTriangleStrip().addTo( this.tiny ).colors( 0x40ffffff );

            this._scrollBar = new TinyGLRectangle().addTo( this.tiny).colors( 0x40ffffff );

            // log
            this.logOffset = 0;
            this.logRows = [];
            var fmt = { id:'log_0', text:'message', type:'log', tf:null };
            this.tf_log_dictionary = {};

            // touch
            this.tracking = { prev:null, vec:null, reverb:null };

            // events
            var self = this;
            this._clearBtn.onTap = function(){ self.clear(); };
            this._onTouchBegin = function( e ){ self.onTouchBegin(e); };
            this._onTouchMove = function( e ){ self.onTouchMove(e); };
            this._onTouchEnd = function( e ){ self.onTouchEnd(e); };
            this._onEnterFrame = function( e ){ self.onEnterFrame(e); };
            this.container.addEventListener( 'touchBegin', this._onTouchBegin );

            // listen
            //this.context.listen( "enterFrame", function(){ self._onEnterFrame(); } );
            //this.context.listen( "log", function(){ self.log.apply( self, arguments ); } );
            this.context.listen( "error", function( error ){ self.onUncaughtError(error); } );

            context.listen( "changeOffset", function(){ self.updateLines(); } );

        }},

        onTouchBegin:{ value:function( e ){
            // start listen
            this.container.stage.addEventListener('touchMove', this._onTouchMove );
            this.container.stage.addEventListener('touchEnd', this._onTouchEnd );

            this.container.stage.removeEventListener('enterFrame', this._onEnterFrame );
            this.container.stage.addEventListener('enterFrame', this._onEnterFrame );

            this.tracking.prev = { x:e.stageX, y:e.stageY };
            this.tracking.vec = { x:0, y:0 };
            this.tracking.reverb = null;
        }},

        onTouchMove:{ value:function(e){
            //
            var curr = { x:e.stageX, y:e.stageY };
            this.tracking.vec.x += curr.x - this.tracking.prev.x;
            this.tracking.vec.y += curr.y - this.tracking.prev.y;
            this.tracking.prev = curr;

        }},

        onTouchEnd:{ value:function(e){

            this.tracking.reverb = { x:this.tracking.vec.x, y:this.tracking.vec.y };
            //
            this.container.stage.removeEventListener('touchMove', this._onTouchMove );
            this.container.stage.removeEventListener('touchEnd', this._onTouchEnd );
            //this.container.stage.removeEventListener('enterFrame', this._onEnterFrame );
        }},

        onEnterFrame:{ value:function(e){

            // reverb
            if( this.tracking.reverb !== null ) {

                this.tracking.reverb.x *= 0.9;
                this.tracking.reverb.y *= 0.9;
                this.tracking.vec.x = this.tracking.reverb.x;
                this.tracking.vec.y = this.tracking.reverb.y;
                if( Math.abs(this.tracking.reverb.y) <= 12 ) {
                    this.tracking.reverb = null;
                    this.container.stage.removeEventListener('enterFrame', this._onEnterFrame );
                }

            }

            //
            if( this.tracking.vec.y === 0 ) return ;

            var surplus = this.tracking.vec.y % 12;
            var value = (this.tracking.vec.y-surplus)/12;
            this.tracking.vec.y = surplus;
            this.logOffset += value;

            if( this.logOffset>=this.logRows.length ) this.logOffset = this.logRows.length-1;
            if( this.logOffset<0 )this.logOffset = 0;

            this.update();

            //this.tracking.vec = {x:0, y:0};
        }},

        resize: { value: function( width, height ){
            View.prototype.resize.apply( this, arguments );
            this.container.mask.width = this.container.hitArea.width = width;
            this.container.mask.height = this.container.hitArea.height = height;
            this.update();
            this._clearBtn.offset(
                -10 + width - this._clearBtn.container.width/2,
                -35 + height - this._clearBtn.container.height/2
            );
            return this;
        }},
        log: { value:function(){
            var row = '';
            for( var i=0; i < arguments.length; i++ ) row += arguments[i] +', ';
            row = row.substr(0,row.length-2);
            //
            this.logRows.push( { id:'log_'+this.logRows.length, text:row, type:'log', tf:null } );
            this.update();
        }},
        onUncaughtError: { value:function(){
            var err = arguments[0];
            var message = '';
            if( err.stack ) {
                // V8
                message += err.message;
                if( err.stack ) message = err.stack;
                //if( err.__stacktrace ) message += ' ' + JSON.stringify( err.__stacktrace );
            } else {
                // JSC
                message += err.message;
                message += ' url:' + err.sourceURL + ' line:' + err.line;
            }

            this.logRows.push( { id:'log_'+this.logRows.length, text:message , type:'error', tf:null } );
            this.update();
        }},
        clear: { value:function(){

            for( var i = 0; i < this.tfs.length; i++ ) {
                this.tfs[i].row =null
            }

            this.logOffset = 0;
            this.logRows = [];
            this.update();
        }},
        update:{ value: function(){
            //
            var offset = this.logOffset;

            for( var i=0; i < this.tfs.length; i++ )
                this.tfs[i].visible = false;

            var sumHeight = 0;
            var index = (this.logRows.length-1) - offset;
            var linePoints = [];
            var globalPoint = this.container.localToGlobal( new Point(0,0) );

            // index以降のlogTFを開放
            for( var i = index+1; i < this.logRows.length; i++ ) {
                if( this.logRows[i].tf ){
                    this.logRows[i].tf.row = null;
                    this.logRows[i].tf = null;
                } else {
                    break;
                }
            }


            while( this.rect.height > sumHeight ) {

                var row = this.logRows[index];
                if(!row)break;

                // textfield

                //  get
                var tf = (row.tf && row.tf.row === row )? row.tf: null;
                //
                if( tf === null ) {
                    //  解放済み使い回し
                    for( var i = 0; i < this.tfs.length; i++ ) {
                        if( this.tfs[i].row === null ) {
                            tf = this.tfs[i];
                            break;
                        }
                    }
                    //  新規生成
                    if( tf === null ) {
                        tf = new TextField();
                        this.container.addChild( tf );
                        tf.autoSize = 'left';
                        tf.wordWrap = true;
                        tf.id = 'tf_' + this.tfs.length;
                        tf.row = null;
                        tf.mouseEnabled = false;
                        this.tfs.push( tf );
                        this._clearBtn.addTo( this.container );
                    }

                    //  update
                    row.tf = tf;
                    tf.row = row;
                    tf.defaultTextFormat = this.fmts[row.type];
                    tf.text = row.text;
                    tf.width = tf.cacheWidth = this.rect.width;
                    tf.cacheHeight = tf.height;
                }

                if( tf.cacheWidth != this.rect.width )
                    tf.width = tf.cacheWidth = this.rect.width;

                sumHeight += tf.cacheHeight;

                tf.y = this.rect.height - sumHeight;
                tf.visible = true;

                // line
                var offsetX = globalPoint.x;
                var offsetY = globalPoint.y + this.rect.height - sumHeight + tf.height;

                linePoints.push(
                    /*this.rect.x + */offsetX, /*this.rect.y + */offsetY -1,
                    /*this.rect.x + */offsetX, /*this.rect.y + */offsetY -1,
                    /*this.rect.x + */offsetX, /*this.rect.y + */offsetY,
                    /*this.rect.x + */this.rect.width + offsetX, /*this.rect.y + */offsetY -1,
                    /*this.rect.x + */this.rect.width + offsetX, /*this.rect.y + */offsetY,
                    /*this.rect.x + */this.rect.width + offsetX, /*this.rect.y + */offsetY
                );

                //
                index--;
            }

            // index以前のlogTFを開放
            for( var i = index; i >= 0; i-- ) {
                if( this.logRows[i].tf ) {
                    this.logRows[i].tf.row = null;
                    this.logRows[i].tf = null;
                } else { break; }
            }
            // lines
            this._lines.points.apply( this._lines, linePoints );


            // bar
            this._scrollBar
                .tl( globalPoint.x + this.rect.x + this.rect.width - 7,
                globalPoint.y + /*this.rect.y + */this.rect.height * ( (index+1) / this.logRows.length ) )
                .br( globalPoint.x + this.rect.x + this.rect.width - 0,
                globalPoint.y + /*this.rect.y + */this.rect.height * ( ((this.logRows.length) - offset) / this.logRows.length ) );
        }},

        /**
         *
         */
        updateLines:{value:function(){

            //
            var linePoints = [];

            var offset = this.logOffset;
            var sumHeight = 0;
            var index = (this.logRows.length-1) - offset;
            var globalPoint = this.container.localToGlobal( new Point(0,0) );


            while( this.rect.height > sumHeight ) {

                var row = this.logRows[index];
                if(!row)break;

                // textfield

                //  get
                var tf = (row.tf && row.tf.row === row )? row.tf: null;
                //
                if( tf === null ) {
                    // 解放済み使い回し
                    for( var i = 0; i < this.tfs.length; i++ ) {
                        if( this.tfs[i].row === null ) {
                            tf = this.tfs[i];
                            break;
                        }
                    }
                    if( tf === null ) {
                        // 新規生成
                        tf = new TextField();
                        this.container.addChild( tf );
                        tf.autoSize = 'left';
                        tf.wordWrap = true;
                        tf.id = 'tf_' + this.tfs.length;
                        tf.row = null;
                        tf.mouseEnabled = false;
                        this.tfs.push( tf );
                        this._clearBtn.addTo( this.container );
                    }

                    //  update
                    row.tf = tf;
                    tf.row = row;
                    tf.defaultTextFormat = this.fmts[row.type];
                    tf.text = row.text;
                }
                //tf.width = this.rect.width;
                sumHeight += tf.height;
                //tf.y = this.rect.height - sumHeight;
                //tf.visible = true;

                // line
                var offsetX = globalPoint.x;
                var offsetY = globalPoint.y + this.rect.height - sumHeight + tf.height;

                linePoints.push(
                    /*this.rect.x + */offsetX, /*this.rect.y + */offsetY -1,
                    /*this.rect.x + */offsetX, /*this.rect.y + */offsetY -1,
                    /*this.rect.x + */offsetX, /*this.rect.y + */offsetY,
                    /*this.rect.x + */this.rect.width + offsetX, /*this.rect.y + */offsetY -1,
                    /*this.rect.x + */this.rect.width + offsetX, /*this.rect.y + */offsetY,
                    /*this.rect.x + */this.rect.width + offsetX, /*this.rect.y + */offsetY
                );

                //
                index--;
            }

            // index以前のlogTFを開放
            for( var i = index; i >= 0; i-- ) {
                if( this.logRows[i].tf ) {
                    this.logRows[i].tf.row = null;
                    this.logRows[i].tf = null;
                } else { break; }
            }
            // lines
            this._lines.points.apply( this._lines, linePoints );

        }},

        show:{value:function(){
            View.prototype.show.call(this);
            this._lines.addTo( this.tiny );
            this._scrollBar.addTo( this.tiny );
        }},
        hide:{value:function(){
            View.prototype.hide.call(this);
            this._lines.removeFrom( this.tiny );
            this._scrollBar.removeFrom( this.tiny );
        }}
    });
})();