module.exports = function(grunt) {
    'use strict';

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        // ファイル結合の設定
        concat: {
            dist: {
                src: [ '*.js', '!node_modules/*', '!output/*' ],
                dest: 'output/<%= pkg.name %>.js'
            }
        },

        // ファイル圧縮の設定
        uglify: {
            options: {
                banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
            },
            build: {
                src: 'output/<%= pkg.name %>.js',
                dest: 'output/<%= pkg.name %>.min.js'
            }
        }
    });

    // プラグインのロード
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');

    // デフォルトタスクの設定
    grunt.registerTask('build', [ 'concat', 'uglify' ]);

};
(function(){

    var createCircularBuffer = function( length, def ){
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

    var Class = function( parent, impl ){
        var cls = function(){ this.initialize.apply(this,arguments); };
        cls.prototype = Object.create( parent.prototype, impl );
        return cls;
    };

    var View = Class( Object, {

        initialize: { value: function(){
            // display
            this.container = new Sprite();

            this.rect = {x:0,y:0,width:0,height:0};
        }},

        isShown:{ get:function(){ return this.container.visible; }},

        addTo: { value: function( parent ){
            parent.addChild( this.container );
            return this;
        }},
        removeFromParent: { value: function(){
            if(this.container.parent) this.container.parent.removeChild(this.container);
            return this;
        }},
        resize: { value: function( width, height ){
            this.rect.width = width;
            this.rect.height = height;
            return this;
        }},
        offset: { value: function( x, y ){
            this.rect.x = this.container.x = x;
            this.rect.y = this.container.y = y;
            return this;
        }},
        show:{ value: function(){
            this.container.visible = true;
            return this;
        }},
        hide:{ value: function(){
            this.container.visible = false;
            return this;
        }}
    });

    var ButtonView = Class( View, {

        initialize: { value: function(){
            View.prototype.initialize.call(this);

            this.onTap = null;
            var self = this;
            this.container.addEventListener( 'touchTap', function(){ if( self.onTap ) self.onTap(); });
        }}

    });

    var TextView = Class( View, {

        initialize: { value: function(){
            View.prototype.initialize.call(this);
            this.tf = new TextField();
            this.tf.autoSize = 'left';
            this.tf.multiline = true;
            this.container.addChild( this.tf );
        }},
        resize:{ value: function( width, height ){
            View.prototype.resize.apply( this, arguments );
            this.tf.width = width;
            this.tf.height = height;
            return this;
        }},
        text:{
            get:function(){ return this.tf.text; },
            set:function( value ){ this.tf.text = value; }
        }

    });

    var LogView = Class( View, {

        initialize: { value: function( tiny ){
            View.prototype.initialize.call(this);

            // display
            this.tfs = [];
            this.fmts = {
                error: new TextFormat( null, 14, 0xff0000 ),
                log: new TextFormat( null, 12, 0xffffff )
            };
            this.container.mask = this.container.addChild( new Bitmap( new BitmapData(1,1,true, 0xffff0000) ) );
            this.container.mask.visible = false;

            this.container.hitArea = this.container.addChild( new Bitmap( new BitmapData(1,1,true, 0xffff0000) ) );
            this.container.hitArea.alpha = 0;

            this._clearBtn = new ButtonView().addTo( this.container );
            this._clearBtnBmp = this._clearBtn.container.addChild( new Bitmap( ) );

            // tiny
            this._tiny = tiny;
            this._lines = new TinyGLTriangleStrip().addTo( this._tiny ).colors( 0x40ffffff );

            this._scrollBar = new TinyGLRectangle().addTo( this._tiny).colors( 0x40ffffff );

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
        }},

        _shareLoadedBitmapData: { value:function(bitmapData){
            this._clearBtnBmp.bitmapData = bitmapData;
            this._clearBtnBmp.setClippingRect( new Rectangle( 51,45,18,18 ) );
            this._clearBtnBmp.width = this._clearBtnBmp.height = 50;
            this._clearBtn.container.x = this.rect.width - this._clearBtn.container.width;
            this._clearBtn.container.y = this.rect.height - this._clearBtn.container.height;
            //this._clearBtnBmp.transform.colorTransform = new ColorTransform(1,1,1,0.4, 255,0,0,0);
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
            this._clearBtn.container.x = width - this._clearBtn.container.width;
            this._clearBtn.container.y = height - this._clearBtn.container.height;
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
            if( app.isANDROID ) {
                message += err.message;
                if( err.stack ) message = err.stack;
                //if( err.__stacktrace ) message += ' ' + JSON.stringify( err.__stacktrace );
            }
            if( app.isIOS ) {
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
                    }

                    //  update
                    row.tf = tf;
                    tf.row = row;
                    tf.defaultTextFormat = this.fmts[row.type];
                    tf.text = row.text;
                }
                tf.width = this.rect.width;
                sumHeight += tf.height;
                tf.y = this.rect.height - sumHeight;
                tf.visible = true;

                // line
                var y = this.rect.height - sumHeight + tf.height;
                linePoints.push(
                    this.rect.x, this.rect.y + y -1,
                    this.rect.x, this.rect.y + y -1,
                    this.rect.x, this.rect.y + y,
                    this.rect.x + this.rect.width, this.rect.y + y -1,
                    this.rect.x + this.rect.width, this.rect.y + y,
                    this.rect.x + this.rect.width, this.rect.y + y
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
                .tl( this.rect.x + this.rect.width - 7,
                this.rect.y + this.rect.height * ( (index+1) / this.logRows.length ) )
                .br( this.rect.x + this.rect.width - 0,
                this.rect.y + this.rect.height * ( ((this.logRows.length) - offset) / this.logRows.length ) );
        }},
        show:{value:function(){
            View.prototype.show.call(this);
            this._lines.addTo( this._tiny );
        }},
        hide:{value:function(){
            View.prototype.hide.call(this);
            this._lines.removeFrom( this._tiny );
        }}
    });

    var TextureView = Class( View, {

        initialize: { value:function( debug ){
            View.prototype.initialize.call(this);
            this._debug = debug;


            // display
            this.tf = new TextField();
            this.container.addChild( this.tf );
            this.tf.text = "0/0";
            this.tf.autoSize = "left";
            this.tf.defaultTextFormat = new TextFormat(null, 20, 0xffffff );
            this.tf.background = true;
            this.tf.backgroundColor = 0x000000;
            this.tf.alpha = 0.5;


            // tiny
            //this._tiny = debug._tiny;
            //this.bg = new TinyGLRectangle().colors(0x88888888);

            this._index = 0;


            this.texView = new GLTextureView(0);
            this.textureLayer = new Layer( this.texView );
            this.textureLayer.alpha = 0.4;

            this.texMatrix = new Matrix();


            this._showTexture(0);
        }},

        offsetX:{
            get:function(){ return this.textureLayer.offsetX; },
            set:function(val){
                this.textureLayer.offsetX = val;
            }
        },

        prev:{value:function(){
            this._showTexture(-1);
            return this;
        }},

        next:{value:function(){
            this._showTexture(+1);
            return this;
        }},

        show:{value:function(){
            View.prototype.show.call(this);
            //this.bg.addTo( this._tiny );
            var index = window.getLayerIndex( this._debug._layer );
            window.addLayerAt( this.textureLayer, index );
            this._showTexture(0);
            return this;
        }},

        hide:{value:function(){
            View.prototype.hide.call(this);
            //this.bg.removeFrom( this._tiny );
            window.removeLayer( this.textureLayer );
            return this;
        }},

        resize: { value: function( width, height ){
            View.prototype.resize.apply( this, arguments );

            //
            //this.bg.tl( this.rect.x, this.rect.y).br( this.rect.x + this.rect.width, this.rect.y + this.rect.height );

            //
            if( this._debug.orientationIsHorizontal ) {
                this.textureLayer.scaleMode = 'noScale';
                this.textureLayer.horizontalAlign = 'left';
                this.textureLayer.verticalAlign = 'center';
            } else {
                this.textureLayer.scaleMode = 'noScale';
                this.textureLayer.horizontalAlign = 'left';
                this.textureLayer.verticalAlign = 'center';
            }

            // sizing


            if( this.textureLayer.content ) {
                var xscale = this.rect.width * this._debug._layer.contentScaleX / this.textureLayer.content.naturalWidth;
                var yscale = this.rect.height * this._debug._layer.contentScaleY / this.textureLayer.content.naturalHeight;
                this.texMatrix.a = this.texMatrix.d = Math.min( xscale, yscale );
                this.textureLayer.content.matrix = this.texMatrix;
            }


            return this;
        }},

        _showTexture:{ value:function( val ){

            var numOfTextures = GLTextureView.getNumOfTextures();
            if( numOfTextures <= 0 ) return;

            this._index += val;
            while( this._index < 0 ) this._index += numOfTextures;
            while( this._index >= numOfTextures ) this._index -= numOfTextures;

            this.tf.text = "" + (this._index+1) + "/" + numOfTextures;

            this.texView.index = this._index;
        }}

    });

    var GraphView = Class( View, {

        initialize: { value: function(tiny){
            View.prototype.initialize.call(this);
            // display
            this.label_fps60 = new TextField();
            this.label_fps60.defaultTextFormat = new TextFormat(null,12,0xffff00);
            this.label_fps60.autoSize = 'left';
            this.label_fps60.text = '60';
            this.container.addChild( this.label_fps60 );
            this.label_fps30 = new TextField();
            this.label_fps30.defaultTextFormat = new TextFormat(null,12,0xffff00);
            this.label_fps30.autoSize = 'left';
            this.label_fps30.text = '30';
            this.container.addChild( this.label_fps30 );

            this.label_mem100 = new TextField();
            this.label_mem100.defaultTextFormat = new TextFormat(null,12,0xff0000);
            this.label_mem100.autoSize = 'left';
            this.label_mem100.text = 'mem:0%';
            this.container.addChild( this.label_mem100 );

            this.label_doc = new TextField();
            this.label_doc.defaultTextFormat = new TextFormat(null,12,0xffffff);
            this.label_doc.autoSize = 'left';
            this.label_doc.text = 'doc:0';
            this.container.addChild( this.label_doc );

            // tiny
            this._tiny = tiny;
            this.bg = new TinyGLRectangle().addTo(tiny).colors(0x22000000).tl(0,0).br(10,10);
            // model
            this.items = {
                memory:{
                    data: createCircularBuffer(20),
                    object: new TinyGLTriangleStrip().colors(0x33ff0000).addTo(this._tiny)
                },
                fps:{
                    data: createCircularBuffer(20),
                    currentCount: 0,
                    prevStamp: null,
                    object: new TinyGLTriangleStrip().colors(0x66ffff00).addTo(this._tiny)
                },
                doc:{
                    data: createCircularBuffer(20),
                    object: new TinyGLTriangleStrip().colors(0x66ffffff).addTo(this._tiny),
                    max: 1
                }
            };
        }},
        resize: { value: function( width, height ){
            View.prototype.resize.apply( this, arguments );
            this.bg.tl( this.container.x, this.container.y ).br( this.container.x + width, this.container.y + height );
            this.update();
            this.label_fps30.y = -this.label_fps30.height/2 + this.rect.height * ( 1 - 30 / 100 );
            this.label_fps60.y = -this.label_fps60.height/2 + this.rect.height * ( 1 - 60 / 100 );
            this.label_mem100.y = this.rect.height * ( 1 - 100 / 100 );
            this.label_mem100.x = this.rect.width - this.label_mem100.width - 6;
            return this;
        }},

        notifyEnterFrame:{value:function( e ){
            if( this.items.fps.prevStamp === null ) this.items.fps.prevStamp = e.timeStamp;
            if( this.items.fps.prevStamp <= (e.timeStamp-1000) ) {

                // sampling
                //  fps
                this.items.fps.data.push( this.items.fps.currentCount );
                this.items.fps.currentCount = 0;
                this.items.fps.prevStamp = e.timeStamp;
                //  mem
                var mem = app.memory;
                this.items.memory.data.push( { used:mem.used, total: mem.total} );
                this.label_mem100.text = "mem:" + Math.ceil( mem.used / mem.total * 100 ) + "%";
                //  doc
                var doc = devtools.getDisplayObjectCount();
                this.label_doc.text = "doc:" + doc;
                this.items.doc.data.push( doc );
                this.items.doc.max = Math.max( this.items.doc.max, doc );

                this.update();
            }
            this.items.fps.currentCount++;
        }},

        update:{ value:function(){

            // fps
            var data = this.items.fps.data;
            var object = this.items.fps.object;

            var max = Number.MIN_VALUE, min = Number.MAX_VALUE;
            for( var i = 0; i < data.length; i++ ) {
                max = Math.max( max, data.get(i) );
                min = Math.min( min, data.get(i) );
            }

            var points = new Array( data.length * 4 );
            var xSpan = this.rect.width / (data.length-1);
            for( var i = 0; i < data.length; i++ ) {
                points[i*4+0] = this.rect.x + i * xSpan;
                points[i*4+1] = this.rect.y + 1 + this.rect.height * ( 1 - data.get(i) / 100 );
                points[i*4+2] = this.rect.x + i * xSpan;
                points[i*4+3] = this.rect.y - 1 + this.rect.height * ( 1 - data.get(i) / 100 );
            }
            object.points.apply( object, points );


            // memory
            data = this.items.memory.data;
            object = this.items.memory.object;

            var points = new Array( data.length * 4 );
            for( var i = 0; i < data.length; i++ ) {
                var dat = data.get(i);
                if(dat===0) dat = {used:0,total:100};
                points[i*4+0] = this.rect.x + i * xSpan;
                points[i*4+1] = this.rect.y + this.rect.height * ( 1 - dat.used / dat.total );
                points[i*4+2] = this.rect.x + i * xSpan;
                points[i*4+3] = this.rect.y + this.rect.height * ( 1 - 0 / dat.total );
            }
            object.points.apply( object, points );

            // doc
            data = this.items.doc.data;
            object = this.items.doc.object;
            var max = this.items.doc.max;
            var points = new Array( data.length * 4 );
            for( var i = 0; i < data.length; i++ ) {
                points[i*4+0] = this.rect.x + i * xSpan;
                points[i*4+1] = this.rect.y + 1 + this.rect.height * ( 1 - data.get(i) / max );
                points[i*4+2] = this.rect.x + i * xSpan;
                points[i*4+3] = this.rect.y - 1 + this.rect.height * ( 1 - data.get(i) / max );
            }
            object.points.apply( object, points );

        }}
    });

    var FooterView = Class( TextView, {

        initialize: { value: function( tiny ){
            TextView.prototype.initialize.call(this);
            // display
            this.tf.autoSize = 'left';
            this.tf.defaultTextFormat = new TextFormat(null, 20);
            this.tf.textColor = 0xffffff;
            this.tf.text = 'IP: ' + app.activeNetworkIP;
            this.tf.x = 18;
            this.tf.y = 2;
            this.tf.alpha = 0.7;
            this.bg = new TinyGLRectangle().addTo(tiny).colors(0x33000000).tl(0,0).br(10,10);

            this.lamp = this.container.addChild( new Bitmap() );
            this.lamp.alpha = 0.7;

        }},
        resize: { value: function( width, height ){
            TextView.prototype.resize.apply( this, arguments );
            this.bg.tl( this.container.x, this.container.y ).br( this.container.x + width, this.container.y + height );
            return this;
        }},
        _shareLoadedBitmapData: { value:function(bitmapData){
            this.lamp.bitmapData = bitmapData;
            this.lamp.setClippingRect( new Rectangle( 66,43,8,8 ) );
            this.lamp.width = this.lamp.height = 10;
            this.lamp.x = 5;
            this.lamp.y = 10;
        }}
    });


    var OPENING = 'opening';
    var CLOSING = 'closing';
    var PullTab = Class( View, {

        initialize: { value: function( debug ){
            View.prototype.initialize.call(this);


            this.state = OPENING;
            this.tweenFlag = false;

            // display

            // debug
            this._debug = debug;

            // touch
            this.tracking = { prevTouch:null, vec: {x:0, y:0}, ave: null, onScreen: false };
            this.startAcc = { index:-1, vecs:[ -0.05, -0.025, -0.0125, -0.00625 ]};

            // event
            var self = this;
            this._onTouch = function(e){ self.onTouch(e); };
            window.addEventListener( 'touchstart', this._onTouch );
        }},

        onTouch:{ value: function(e){
            var t = e.changedTouches.item(0);
            var self = this;
            switch( e.type ) {
                case 'touchstart':

                    if( this._debug.isShown !== true ) {
                        this.state = OPENING;
                        if( t.y <= (window.innerHeight*4/5) ) return;
                        if( t.x <= (window.innerWidth*9/10) ) return;

                        this._debug.offsetX = 1;
                        this._debug.show();
                        this.startAcc.index = 0;

                        window.addEventListener( 'touchmove', this._onTouch );
                        window.addEventListener( 'touchend', this._onTouch );
                        window.addEventListener( 'touchcancel', this._onTouch );
                        this.tracking.vec = {x:0, y:0};
                        this.tracking.ave = null;
                        this.tracking.prevTouch = { x: t.x, y: t.y };
                    } else {
                        this.state = CLOSING;

                        //if( this._debug.orientationIsHorizontal !== true && t.y <= (window.innerHeight*3/5) ) return;
                        //if( this._debug.orientationIsHorizontal && t.x <= (window.innerWidth*3/5) ) return;

                        window.addEventListener( 'touchmove', this._onTouch );
                        window.addEventListener( 'touchend', this._onTouch );
                        window.addEventListener( 'touchcancel', this._onTouch );
                        this.tracking.vec = {x:0, y:0};
                        this.tracking.prevTouch = { x: t.x, y: t.y };
                    }

                    this.tracking.onScreen = true;

                    break;
                case 'touchmove':
                    this.tracking.vec.x += t.x - this.tracking.prevTouch.x;
                    this.tracking.vec.y += t.y - this.tracking.prevTouch.y;
                    this.tracking.prevTouch = { x: t.x, y: t.y };
                    break;
                case 'touchend':
                case 'touchcancel':
                    window.removeEventListener( 'touchmove', this._onTouch );
                    window.removeEventListener( 'touchend', this._onTouch );
                    window.removeEventListener( 'touchcancel', this._onTouch );

                    this.startAcc.index = -1;

                    this.tracking.vec.x += t.x - this.tracking.prevTouch.x;
                    this.tracking.vec.y += t.y - this.tracking.prevTouch.y;

                    if( this.state === OPENING && this.tracking.vec.x < 5 ) this.open();
                    if( this.state === OPENING && this.tracking.vec.x >= 5 ) this.close();

                    this.tracking.onScreen = false;
                    this.tracking.prevTouch = null;

                    break;
            }
        }},

        open: { value: function(){
            if( this._debug.isShown && this._debug.offsetX === 0 ) return;
            this.state = OPENING;
            this.tweenFlag = true;
        }},

        close: { value: function(){
            if( this._debug.isShown!==true && this._debug.offsetX === 1 ) return;
            this.state = CLOSING;
            this.tweenFlag = true;
        }},

        notifyEnterFrame:{ value:function( e ){

            if( this.tweenFlag ) {
                if( this.state === OPENING ) {
                    this._debug.offsetX += (0-this._debug.offsetX)*0.3;
                    if( this._debug.offsetX<=0.01 ){
                        this._debug.offsetX = 0;
                        this.tweenFlag = false;
                    }
                }
                if( this.state === CLOSING ) {
                    this._debug.offsetX += (1-this._debug.offsetX)*0.3;
                    if( this._debug.offsetX>=0.99 ) {
                        this._debug.offsetX = 1;
                        this.tweenFlag = false;
                        this._debug.hide();
                    }
                }

                return;
            }

            // touch
            if( this.tracking.ave == null ) this.tracking.ave = { x:this.tracking.vec.x, y:this.tracking.vec.y };
            this.tracking.ave.x = this.tracking.ave.x/2 + this.tracking.vec.x/2;
            this.tracking.ave.y = this.tracking.ave.y/2 + this.tracking.vec.y/2;

            if( this.state === OPENING && this.tracking.onScreen == true ) {
                var val = this.tracking.vec.x / window.innerWidth;
                if( this.startAcc.index>=0 ) {
                    val += this.startAcc.vecs[ this.startAcc.index ];
                    this.startAcc.index++;
                    if( this.startAcc.vecs.length<=this.startAcc.index ) this.startAcc.index = -1;
                }
                this._debug.offsetX += val;

            } else if( this.state === CLOSING && this.tracking.onScreen != true ) {
                var val = this.tracking.ave.x / window.innerWidth;
                if( val > 0.05 ) {
                    this.close();
                }
            }
            this.tracking.vec = {x:0, y:0};
        }}
    });


    var nativeConsoleLog = console.log;
    var nativeOnUncaughtError = window.onUncaughtError;

    var Debugger = Class( Object, {

        initialize: { value: function(){
            // display
            this._stage = new Stage(100,100);
            this._layer = new Layer( this._stage );
            this._layer.alpha = 0.7;
            // tiny
            this._tiny = new TinyGL(100,100);
            this._tinyLayer = new Layer( this._tiny );
            this._bg = new TinyGLRectangle().addTo( this._tiny).colors(0xbb000000).tl(0,0).br(100,100);

            // view
            this._logView = new LogView( this._tiny ).addTo( this._stage );
            this._textureView = new TextureView( this ).addTo( this._stage).hide();// TODO
            this._graphView = new GraphView( this._tiny ).addTo( this._stage );
            this._buttonList = new View().addTo( this._stage );
            this._footer = new FooterView( this._tiny ).addTo( this._stage );
            this._pullTab = new PullTab(this);// TODO 単体のLayerか？

            // listeners
            this._onOrientationChange = null;
            this._onEnterFrame = null;
            this._onLoadImage = null;
            this._onTouch = null;

            // touch
            this.tracking = { prev:null, vec: {x:0, y:0} };

            //
            this._isShown = false;

            // prepare..
            var self = this;
            (function(){
                var img = new Image();
                img.src = 'data:image/png;base64,'
                    +'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';
                img.onload = function() {
                    console.log('aaaaaas');
                    self._onLoadImage(this);
                    self._onLoadImage = null;
                };
            })();

            this._onLoadImage = function(img){
                console.log('aaa');
                var bd = new BitmapData( img );
                var btn = null;
                var bgbd = new BitmapData( 1,1,true, 0x00000000 );
                var bmp = null, spacer = null;
                var self = this;
                var ct = new ColorTransform(1,1,1,0.4,255,255,255,0);

                this._logView._shareLoadedBitmapData( bd );
                this._footer._shareLoadedBitmapData( bd );

                // logBtn
                btn = new ButtonView().addTo( this._buttonList.container );
                spacer = btn.container.addChild( new Bitmap( bgbd ) );
                spacer.width = spacer.height = 50;
                bmp = btn.container.addChild( new Bitmap( bd, true, true, new Rectangle(47,0,45,40) ) );
                //bmp.transform.colorTransform = ct;
                bmp.x = 3;
                bmp.y = 5;
                btn.container.width = btn.container.height = 100;
                btn.onTap = function(){ self._textureView.hide(); self._logView.show(); };
                btn.container.x = 0;
                btn.container.y = 0;

                // textureBtn
                btn = new ButtonView().addTo( this._buttonList.container );
                spacer = btn.container.addChild( new Bitmap( bgbd ) );
                spacer.width = spacer.height = 50;
                bmp = btn.container.addChild( new Bitmap( bd, true, true, new Rectangle(0,0,44,40) ) );
                //bmp.transform.colorTransform = ct;
                bmp.x = 3;
                bmp.y = 5;
                btn.container.width = btn.container.height = 100;
                btn.onTap = function(){
                    self._logView.hide();
                    if( self._textureView.isShown ) {
                        self._textureView.next();
                    } else {
                        self._textureView.show();
                    }
                };
                btn.container.x = 100;
                btn.container.y = 0;

                // reloadBtn
                btn = new ButtonView().addTo( this._buttonList.container );
                spacer = btn.container.addChild( new Bitmap( bgbd ) );
                spacer.width = spacer.height = 22;
                bmp = btn.container.addChild( new Bitmap( bd, true, true, new Rectangle(15,44,18,18) ) );
                //bmp.transform.colorTransform = ct;
                bmp.x = 2;
                bmp.y = 2;
                btn.container.width = btn.container.height = 100;
                btn.onTap = function(){ location.reload(); };
                btn.container.x = 0;
                btn.container.y = 100;

                // gcBtn
                var btn = new ButtonView().addTo( this._buttonList.container );
                spacer = btn.container.addChild( new Bitmap( bgbd ) );
                spacer.width = spacer.height = 22;
                bmp = btn.container.addChild( new Bitmap( bd, true, true, new Rectangle(34,43,16.5,20) ) );
                //bmp.transform.colorTransform = ct;
                bmp.x = 1;
                bmp.y = 1;
                btn.container.width = btn.container.height = 100;
                btn.onTap = function(){ app.gc(); };
                btn.container.x = 100;
                btn.container.y = 100;

            };
        }},

        orientationIsHorizontal:{
            get:function(){ return (window.innerWidth > window.innerHeight) }
        },

        offsetX:{
            get:function(){ return this._layer.offsetX; },
            set:function(val){
                this._layer.offsetX = this._tinyLayer.offsetX = val;
                this._textureView.offsetX = this._layer.offsetX;
            }
        },

        isShown: {
            get:function(){ return this._isShown; }
        },

        show: { value: function(){
            if( this.isShown ) return;
            this._isShown = true;
            // show
            window.addLayer( this._tinyLayer );
            window.addLayer( this._layer );
            // events
            var self = this;
            window.addEventListener( 'orientationchange', ( this._onOrientationChange = function(){ setTimeout(function(){self._layOut();},1000); } ) );
            this._stage.addEventListener( 'enterFrame',( this._onEnterFrame = function(e){ self.onEnterFrame(e); } ) );

            this._logView.show();
            this._layOut();

        }},

        hide: { value: function(){
            if( !this.isShown ) return;
            this._isShown = false;
            // hide
            window.removeLayer( this._layer );
            window.removeLayer( this._tinyLayer );
            // events
            window.removeEventListener( 'orientationchange', this._onOrientationChange );
            this._stage.removeEventListener( 'enterFrame', this._onEnterFrame );
            this._onOrientationChange = null;

            // view
            this._logView.hide();
            this._textureView.hide();
        }},

        log:{ value: function(){
            this._logView.log.apply( this._logView, arguments );
            nativeConsoleLog.apply( console, arguments );
        }},

        onEnterFrame:{ value:function(e){
            this._graphView.notifyEnterFrame(e);
            this._pullTab.notifyEnterFrame(e);
        }},


        onUncaughtError:{ value: function(){
            this._logView.onUncaughtError.apply( this._logView, arguments );
            this.show();
            nativeOnUncaughtError.apply( window, arguments );
        }},

        _layOut: { value: function(){
            //
            var footHeight = 30;
            //
            var width;
            var height;
            if( this.orientationIsHorizontal ) {
                // 横向き
                var width = 640 * ( window.innerWidth / window.innerHeight ) * 2/3;
                var height = 640 * 2/3;

                this._tiny.width = this._stage.stageWidth = width;
                this._tiny.height = this._stage.stageHeight = height;
                this._bg.br( width, height );

                this._logView.offset(0,0).resize( width*3/5, height - footHeight );
                this._textureView.offset(0,0).resize( width*3/5, height - footHeight );
                this._graphView.offset(width*3/5,0).resize( width*2/5, height/2 );
                this._buttonList.offset(width*3/5,height/2);
                this._footer.offset(0, height - footHeight).resize( width, footHeight );
            } else {
                // 縦向き
                var width = 640 * 2/3;
                var height = 640 * ( window.innerHeight / window.innerWidth ) * 2/3;

                this._tiny.width = this._stage.stageWidth = width;
                this._tiny.height = this._stage.stageHeight = height;
                this._bg.br( width, height );

                this._logView.offset(0,0).resize( width, height*3/5 );
                this._textureView.offset(0,0).resize( width, height*3/5 );
                this._graphView.offset(width/2,height*3/5).resize( width/2, height*2/5 - footHeight );
                this._buttonList.offset(0,height*3/5);
                this._footer.offset(0, height - footHeight).resize( width, footHeight );
            }
        }}

    });

    var instance = new Debugger();

    console.log = function(){ instance.log.apply( instance, arguments );};
    window.onUncaughtError = function(){ instance.onUncaughtError.apply( instance, arguments );};

    if( window.devtools ) {
        window.devtools.view = instance;
    } else {
        window.debug = instance;
    }

})();

//var underscore = require('underscore');

helpers = new function(){
    this.isArray = function( obj ){ return obj instanceof Array };
    this.isRegExp = function( obj ){ return obj instanceof RegExp };
    this.isDate = function( obj ){ return obj instanceof Date };
    this.isUndefined = function( obj ){ return obj === undefined; };
    this.isObject = function( obj ){ return obj instanceof Object; };
};//underscore;
//module.exports = helpers;

var primitiveTypes = {
    undefined: true,
    boolean: true,
    number: true,
    string: true
};

var isPrimitiveValue = function(object) {
    return primitiveTypes[typeof object];
};

//helpers.mixin({ isPrimitiveValue: isPrimitiveValue });
helpers.isPrimitiveValue = isPrimitiveValue;

var subtype = function(obj) {
    if (obj === null) return "null";

    var type = typeof obj;
    if (helpers.isPrimitiveValue(obj)) return null;

    if (helpers.isArray(obj)) return "array";
    if (helpers.isRegExp(obj)) return "regexp";
    if (helpers.isDate(obj)) return "date";

    // FireBug's array detection.
    try {
        if (Object.prototype.toString.call(obj) === "[object Arguments]" &&
            isFinite(obj.length)) {
            return "array";
        }
    } catch (e) {
    }

    return null;
};

helpers.subtype = subtype;

var describe = function(obj) {
    if (helpers.isPrimitiveValue(obj)) return null;

    var subtype = helpers.subtype(obj);

    if (subtype === "regexp") return '' + obj;
    if (subtype === "date") return '' + obj;

    if (subtype === "array") {
        var className = 'array ';
        if (typeof obj.length === "number")
            className += "[" + obj.length + "]";
        return className;
    }

    if (typeof obj === "function") return "" + obj;

    if (helpers.isObject(obj)) {
        // In Chromium DOM wrapper prototypes will have Object as their constructor name,
        // get the real DOM wrapper name from the constructor property.
        var constructorName = obj.constructor && obj.constructor.name;
        if (constructorName)
            return constructorName;
    }
    return '' + obj;
};

var decycle = function(object) {
    'use strict';

//Taken from https://github.com/douglascrockford/JSON-js/blob/master/cycle.js

// Make a deep copy of an object or array, assuring that there is at most
// one instance of each object or array in the resulting structure. The
// duplicate references (which might be forming cycles) are replaced with
// an object of the form
//      {$ref: PATH}
// where the PATH is a JSONPath string that locates the first occurance.
// So,
//      var a = [];
//      a[0] = a;
//      return JSON.stringify(JSON.decycle(a));
// produces the string '[{"$ref":"$"}]'.

// JSONPath is used to locate the unique object. $ indicates the top level of
// the object or array. [NUMBER] or [STRING] indicates a child member or
// property.

    var objects = [],   // Keep a reference to each unique object or array
        paths = [];     // Keep the path to each unique object or array

    return (function derez(value, path) {

// The derez recurses through the object, producing the deep copy.

        var i,          // The loop counter
            name,       // Property name
            nu;         // The new object or array

        switch (typeof value) {
            case 'object':

// typeof null === 'object', so get out if this value is not really an object.

                if (!value) {
                    return null;
                }

// If the value is an object or array, look to see if we have already
// encountered it. If so, return a $ref/path object. This is a hard way,
// linear search that will get slower as the number of unique objects grows.

                for (i = 0; i < objects.length; i += 1) {
                    if (objects[i] === value) {
                        return {$ref: paths[i]};
                    }
                }

// Otherwise, accumulate the unique value and its path.

                objects.push(value);
                paths.push(path);

// If it is an array, replicate the array.

                if (Object.prototype.toString.apply(value) === '[object Array]') {
                    nu = [];
                    for (i = 0; i < value.length; i += 1) {
                        nu[i] = derez(value[i], path + '[' + i + ']');
                    }
                } else {

// If it is an object, replicate the object.

                    nu = {};
                    for (name in value) {
                        if (Object.prototype.hasOwnProperty.call(value, name)) {
                            nu[name] = derez(value[name],
                                path + '[' + JSON.stringify(name) + ']');
                        }
                    }
                }
                return nu;
            case 'number':
            case 'string':
            case 'boolean':
                return value;
        }
    }(object, '$'));
};

//helpers.mixin({ decycle: decycle });
helpers.decycle = decycle;
//helpers.mixin({ describe: describe });
helpers.describe = describe;

(function(){

    var createCircularBuffer = function( length, def ){
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

    var Class = function( parent, impl ){
        var cls = function(){ this.initialize.apply(this,arguments); };
        cls.prototype = Object.create( parent.prototype, impl );
        return cls;
    };

    var View = Class( Object, {

        initialize: { value: function(){
            // display
            this.container = new Sprite();

            this.rect = {x:0,y:0,width:0,height:0};
        }},

        isShown:{ get:function(){ return this.container.visible; }},

        addTo: { value: function( parent ){
            parent.addChild( this.container );
            return this;
        }},
        removeFromParent: { value: function(){
            if(this.container.parent) this.container.parent.removeChild(this.container);
            return this;
        }},
        resize: { value: function( width, height ){
            this.rect.width = width;
            this.rect.height = height;
            return this;
        }},
        offset: { value: function( x, y ){
            this.rect.x = this.container.x = x;
            this.rect.y = this.container.y = y;
            return this;
        }},
        show:{ value: function(){
            this.container.visible = true;
            return this;
        }},
        hide:{ value: function(){
            this.container.visible = false;
            return this;
        }}
    });

    var ButtonView = Class( View, {

        initialize: { value: function(){
            View.prototype.initialize.call(this);

            this.onTap = null;
            var self = this;
            this.container.addEventListener( 'touchTap', function(){ if( self.onTap ) self.onTap(); });
        }}

    });

    var TextView = Class( View, {

        initialize: { value: function(){
            View.prototype.initialize.call(this);
            this.tf = new TextField();
            this.tf.autoSize = 'left';
            this.tf.multiline = true;
            this.container.addChild( this.tf );
        }},
        resize:{ value: function( width, height ){
            View.prototype.resize.apply( this, arguments );
            this.tf.width = width;
            this.tf.height = height;
            return this;
        }},
        text:{
            get:function(){ return this.tf.text; },
            set:function( value ){ this.tf.text = value; }
        }

    });

    var LogView = Class( View, {

        initialize: { value: function( tiny ){
            View.prototype.initialize.call(this);

            // display
            this.tfs = [];
            this.fmts = {
                error: new TextFormat( null, 14, 0xff0000 ),
                log: new TextFormat( null, 12, 0xffffff )
            };
            this.container.mask = this.container.addChild( new Bitmap( new BitmapData(1,1,true, 0xffff0000) ) );
            this.container.mask.visible = false;

            this.container.hitArea = this.container.addChild( new Bitmap( new BitmapData(1,1,true, 0xffff0000) ) );
            this.container.hitArea.alpha = 0;

            this._clearBtn = new ButtonView().addTo( this.container );
            this._clearBtnBmp = this._clearBtn.container.addChild( new Bitmap( ) );

            // tiny
            this._tiny = tiny;
            this._lines = new TinyGLTriangleStrip().addTo( this._tiny ).colors( 0x40ffffff );

            this._scrollBar = new TinyGLRectangle().addTo( this._tiny).colors( 0x40ffffff );

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
        }},

        _shareLoadedBitmapData: { value:function(bitmapData){
            this._clearBtnBmp.bitmapData = bitmapData;
            this._clearBtnBmp.setClippingRect( new Rectangle( 51,45,18,18 ) );
            this._clearBtnBmp.width = this._clearBtnBmp.height = 50;
            this._clearBtn.container.x = this.rect.width - this._clearBtn.container.width;
            this._clearBtn.container.y = this.rect.height - this._clearBtn.container.height;
            //this._clearBtnBmp.transform.colorTransform = new ColorTransform(1,1,1,0.4, 255,0,0,0);
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
            this._clearBtn.container.x = width - this._clearBtn.container.width;
            this._clearBtn.container.y = height - this._clearBtn.container.height;
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
            if( app.isANDROID ) {
                message += err.message;
                if( err.stack ) message = err.stack;
                //if( err.__stacktrace ) message += ' ' + JSON.stringify( err.__stacktrace );
            }
            if( app.isIOS ) {
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
                    }

                    //  update
                    row.tf = tf;
                    tf.row = row;
                    tf.defaultTextFormat = this.fmts[row.type];
                    tf.text = row.text;
                }
                tf.width = this.rect.width;
                sumHeight += tf.height;
                tf.y = this.rect.height - sumHeight;
                tf.visible = true;

                // line
                var y = this.rect.height - sumHeight + tf.height;
                linePoints.push(
                    this.rect.x, this.rect.y + y -1,
                    this.rect.x, this.rect.y + y -1,
                    this.rect.x, this.rect.y + y,
                    this.rect.x + this.rect.width, this.rect.y + y -1,
                    this.rect.x + this.rect.width, this.rect.y + y,
                    this.rect.x + this.rect.width, this.rect.y + y
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
                .tl( this.rect.x + this.rect.width - 7,
                this.rect.y + this.rect.height * ( (index+1) / this.logRows.length ) )
                .br( this.rect.x + this.rect.width - 0,
                this.rect.y + this.rect.height * ( ((this.logRows.length) - offset) / this.logRows.length ) );
        }},
        show:{value:function(){
            View.prototype.show.call(this);
            this._lines.addTo( this._tiny );
        }},
        hide:{value:function(){
            View.prototype.hide.call(this);
            this._lines.removeFrom( this._tiny );
        }}
    });

    var TextureView = Class( View, {

        initialize: { value:function( debug ){
            View.prototype.initialize.call(this);
            this._debug = debug;


            // display
            this.tf = new TextField();
            this.container.addChild( this.tf );
            this.tf.text = "0/0";
            this.tf.autoSize = "left";
            this.tf.defaultTextFormat = new TextFormat(null, 20, 0xffffff );
            this.tf.background = true;
            this.tf.backgroundColor = 0x000000;
            this.tf.alpha = 0.5;


            // tiny
            //this._tiny = debug._tiny;
            //this.bg = new TinyGLRectangle().colors(0x88888888);

            this._index = 0;


            this.texView = new GLTextureView(0);
            this.textureLayer = new Layer( this.texView );
            this.textureLayer.alpha = 0.4;

            this.texMatrix = new Matrix();


            this._showTexture(0);
        }},

        offsetX:{
            get:function(){ return this.textureLayer.offsetX; },
            set:function(val){
                this.textureLayer.offsetX = val;
            }
        },

        prev:{value:function(){
            this._showTexture(-1);
            return this;
        }},

        next:{value:function(){
            this._showTexture(+1);
            return this;
        }},

        show:{value:function(){
            View.prototype.show.call(this);
            //this.bg.addTo( this._tiny );
            var index = window.getLayerIndex( this._debug._layer );
            window.addLayerAt( this.textureLayer, index );
            this._showTexture(0);
            return this;
        }},

        hide:{value:function(){
            View.prototype.hide.call(this);
            //this.bg.removeFrom( this._tiny );
            window.removeLayer( this.textureLayer );
            return this;
        }},

        resize: { value: function( width, height ){
            View.prototype.resize.apply( this, arguments );

            //
            //this.bg.tl( this.rect.x, this.rect.y).br( this.rect.x + this.rect.width, this.rect.y + this.rect.height );

            //
            if( this._debug.orientationIsHorizontal ) {
                this.textureLayer.scaleMode = 'noScale';
                this.textureLayer.horizontalAlign = 'left';
                this.textureLayer.verticalAlign = 'center';
            } else {
                this.textureLayer.scaleMode = 'noScale';
                this.textureLayer.horizontalAlign = 'left';
                this.textureLayer.verticalAlign = 'center';
            }

            // sizing


            if( this.textureLayer.content ) {
                var xscale = this.rect.width * this._debug._layer.contentScaleX / this.textureLayer.content.naturalWidth;
                var yscale = this.rect.height * this._debug._layer.contentScaleY / this.textureLayer.content.naturalHeight;
                this.texMatrix.a = this.texMatrix.d = Math.min( xscale, yscale );
                this.textureLayer.content.matrix = this.texMatrix;
            }


            return this;
        }},

        _showTexture:{ value:function( val ){

            var numOfTextures = GLTextureView.getNumOfTextures();
            if( numOfTextures <= 0 ) return;

            this._index += val;
            while( this._index < 0 ) this._index += numOfTextures;
            while( this._index >= numOfTextures ) this._index -= numOfTextures;

            this.tf.text = "" + (this._index+1) + "/" + numOfTextures;

            this.texView.index = this._index;
        }}

    });

    var GraphView = Class( View, {

        initialize: { value: function(tiny){
            View.prototype.initialize.call(this);
            // display
            this.label_fps60 = new TextField();
            this.label_fps60.defaultTextFormat = new TextFormat(null,12,0xffff00);
            this.label_fps60.autoSize = 'left';
            this.label_fps60.text = '60';
            this.container.addChild( this.label_fps60 );
            this.label_fps30 = new TextField();
            this.label_fps30.defaultTextFormat = new TextFormat(null,12,0xffff00);
            this.label_fps30.autoSize = 'left';
            this.label_fps30.text = '30';
            this.container.addChild( this.label_fps30 );

            this.label_mem100 = new TextField();
            this.label_mem100.defaultTextFormat = new TextFormat(null,12,0xff0000);
            this.label_mem100.autoSize = 'left';
            this.label_mem100.text = 'mem:0%';
            this.container.addChild( this.label_mem100 );

            this.label_doc = new TextField();
            this.label_doc.defaultTextFormat = new TextFormat(null,12,0xffffff);
            this.label_doc.autoSize = 'left';
            this.label_doc.text = 'doc:0';
            this.container.addChild( this.label_doc );

            // tiny
            this._tiny = tiny;
            this.bg = new TinyGLRectangle().addTo(tiny).colors(0x22000000).tl(0,0).br(10,10);
            // model
            this.items = {
                memory:{
                    data: createCircularBuffer(20),
                    object: new TinyGLTriangleStrip().colors(0x33ff0000).addTo(this._tiny)
                },
                fps:{
                    data: createCircularBuffer(20),
                    currentCount: 0,
                    prevStamp: null,
                    object: new TinyGLTriangleStrip().colors(0x66ffff00).addTo(this._tiny)
                },
                doc:{
                    data: createCircularBuffer(20),
                    object: new TinyGLTriangleStrip().colors(0x66ffffff).addTo(this._tiny),
                    max: 1
                }
            };
        }},
        resize: { value: function( width, height ){
            View.prototype.resize.apply( this, arguments );
            this.bg.tl( this.container.x, this.container.y ).br( this.container.x + width, this.container.y + height );
            this.update();
            this.label_fps30.y = -this.label_fps30.height/2 + this.rect.height * ( 1 - 30 / 100 );
            this.label_fps60.y = -this.label_fps60.height/2 + this.rect.height * ( 1 - 60 / 100 );
            this.label_mem100.y = this.rect.height * ( 1 - 100 / 100 );
            this.label_mem100.x = this.rect.width - this.label_mem100.width - 6;
            return this;
        }},

        notifyEnterFrame:{value:function( e ){
            if( this.items.fps.prevStamp === null ) this.items.fps.prevStamp = e.timeStamp;
            if( this.items.fps.prevStamp <= (e.timeStamp-1000) ) {

                // sampling
                //  fps
                this.items.fps.data.push( this.items.fps.currentCount );
                this.items.fps.currentCount = 0;
                this.items.fps.prevStamp = e.timeStamp;
                //  mem
                var mem = app.memory;
                this.items.memory.data.push( { used:mem.used, total: mem.total} );
                this.label_mem100.text = "mem:" + Math.ceil( mem.used / mem.total * 100 ) + "%";
                //  doc
                var doc = devtools.getDisplayObjectCount();
                this.label_doc.text = "doc:" + doc;
                this.items.doc.data.push( doc );
                this.items.doc.max = Math.max( this.items.doc.max, doc );

                this.update();
            }
            this.items.fps.currentCount++;
        }},

        update:{ value:function(){

            // fps
            var data = this.items.fps.data;
            var object = this.items.fps.object;

            var max = Number.MIN_VALUE, min = Number.MAX_VALUE;
            for( var i = 0; i < data.length; i++ ) {
                max = Math.max( max, data.get(i) );
                min = Math.min( min, data.get(i) );
            }

            var points = new Array( data.length * 4 );
            var xSpan = this.rect.width / (data.length-1);
            for( var i = 0; i < data.length; i++ ) {
                points[i*4+0] = this.rect.x + i * xSpan;
                points[i*4+1] = this.rect.y + 1 + this.rect.height * ( 1 - data.get(i) / 100 );
                points[i*4+2] = this.rect.x + i * xSpan;
                points[i*4+3] = this.rect.y - 1 + this.rect.height * ( 1 - data.get(i) / 100 );
            }
            object.points.apply( object, points );


            // memory
            data = this.items.memory.data;
            object = this.items.memory.object;

            var points = new Array( data.length * 4 );
            for( var i = 0; i < data.length; i++ ) {
                var dat = data.get(i);
                if(dat===0) dat = {used:0,total:100};
                points[i*4+0] = this.rect.x + i * xSpan;
                points[i*4+1] = this.rect.y + this.rect.height * ( 1 - dat.used / dat.total );
                points[i*4+2] = this.rect.x + i * xSpan;
                points[i*4+3] = this.rect.y + this.rect.height * ( 1 - 0 / dat.total );
            }
            object.points.apply( object, points );

            // doc
            data = this.items.doc.data;
            object = this.items.doc.object;
            var max = this.items.doc.max;
            var points = new Array( data.length * 4 );
            for( var i = 0; i < data.length; i++ ) {
                points[i*4+0] = this.rect.x + i * xSpan;
                points[i*4+1] = this.rect.y + 1 + this.rect.height * ( 1 - data.get(i) / max );
                points[i*4+2] = this.rect.x + i * xSpan;
                points[i*4+3] = this.rect.y - 1 + this.rect.height * ( 1 - data.get(i) / max );
            }
            object.points.apply( object, points );

        }}
    });

    var FooterView = Class( TextView, {

        initialize: { value: function( tiny ){
            TextView.prototype.initialize.call(this);
            // display
            this.tf.autoSize = 'left';
            this.tf.defaultTextFormat = new TextFormat(null, 20);
            this.tf.textColor = 0xffffff;
            this.tf.text = 'IP: ' + app.activeNetworkIP;
            this.tf.x = 18;
            this.tf.y = 2;
            this.tf.alpha = 0.7;
            this.bg = new TinyGLRectangle().addTo(tiny).colors(0x33000000).tl(0,0).br(10,10);

            this.lamp = this.container.addChild( new Bitmap() );
            this.lamp.alpha = 0.7;

        }},
        resize: { value: function( width, height ){
            TextView.prototype.resize.apply( this, arguments );
            this.bg.tl( this.container.x, this.container.y ).br( this.container.x + width, this.container.y + height );
            return this;
        }},
        _shareLoadedBitmapData: { value:function(bitmapData){
            this.lamp.bitmapData = bitmapData;
            this.lamp.setClippingRect( new Rectangle( 66,43,8,8 ) );
            this.lamp.width = this.lamp.height = 10;
            this.lamp.x = 5;
            this.lamp.y = 10;
        }}
    });


    var OPENING = 'opening';
    var CLOSING = 'closing';
    var PullTab = Class( View, {

        initialize: { value: function( debug ){
            View.prototype.initialize.call(this);


            this.state = OPENING;
            this.tweenFlag = false;

            // display

            // debug
            this._debug = debug;

            // touch
            this.tracking = { prevTouch:null, vec: {x:0, y:0}, ave: null, onScreen: false };
            this.startAcc = { index:-1, vecs:[ -0.05, -0.025, -0.0125, -0.00625 ]};

            // event
            var self = this;
            this._onTouch = function(e){ self.onTouch(e); };
            window.addEventListener( 'touchstart', this._onTouch );
        }},

        onTouch:{ value: function(e){
            var t = e.changedTouches.item(0);
            var self = this;
            switch( e.type ) {
                case 'touchstart':

                    if( this._debug.isShown !== true ) {
                        this.state = OPENING;
                        if( t.y <= (window.innerHeight*4/5) ) return;
                        if( t.x <= (window.innerWidth*9/10) ) return;

                        this._debug.offsetX = 1;
                        this._debug.show();
                        this.startAcc.index = 0;

                        window.addEventListener( 'touchmove', this._onTouch );
                        window.addEventListener( 'touchend', this._onTouch );
                        window.addEventListener( 'touchcancel', this._onTouch );
                        this.tracking.vec = {x:0, y:0};
                        this.tracking.ave = null;
                        this.tracking.prevTouch = { x: t.x, y: t.y };
                    } else {
                        this.state = CLOSING;

                        //if( this._debug.orientationIsHorizontal !== true && t.y <= (window.innerHeight*3/5) ) return;
                        //if( this._debug.orientationIsHorizontal && t.x <= (window.innerWidth*3/5) ) return;

                        window.addEventListener( 'touchmove', this._onTouch );
                        window.addEventListener( 'touchend', this._onTouch );
                        window.addEventListener( 'touchcancel', this._onTouch );
                        this.tracking.vec = {x:0, y:0};
                        this.tracking.prevTouch = { x: t.x, y: t.y };
                    }

                    this.tracking.onScreen = true;

                    break;
                case 'touchmove':
                    this.tracking.vec.x += t.x - this.tracking.prevTouch.x;
                    this.tracking.vec.y += t.y - this.tracking.prevTouch.y;
                    this.tracking.prevTouch = { x: t.x, y: t.y };
                    break;
                case 'touchend':
                case 'touchcancel':
                    window.removeEventListener( 'touchmove', this._onTouch );
                    window.removeEventListener( 'touchend', this._onTouch );
                    window.removeEventListener( 'touchcancel', this._onTouch );

                    this.startAcc.index = -1;

                    this.tracking.vec.x += t.x - this.tracking.prevTouch.x;
                    this.tracking.vec.y += t.y - this.tracking.prevTouch.y;

                    if( this.state === OPENING && this.tracking.vec.x < 5 ) this.open();
                    if( this.state === OPENING && this.tracking.vec.x >= 5 ) this.close();

                    this.tracking.onScreen = false;
                    this.tracking.prevTouch = null;

                    break;
            }
        }},

        open: { value: function(){
            if( this._debug.isShown && this._debug.offsetX === 0 ) return;
            this.state = OPENING;
            this.tweenFlag = true;
        }},

        close: { value: function(){
            if( this._debug.isShown!==true && this._debug.offsetX === 1 ) return;
            this.state = CLOSING;
            this.tweenFlag = true;
        }},

        notifyEnterFrame:{ value:function( e ){

            if( this.tweenFlag ) {
                if( this.state === OPENING ) {
                    this._debug.offsetX += (0-this._debug.offsetX)*0.3;
                    if( this._debug.offsetX<=0.01 ){
                        this._debug.offsetX = 0;
                        this.tweenFlag = false;
                    }
                }
                if( this.state === CLOSING ) {
                    this._debug.offsetX += (1-this._debug.offsetX)*0.3;
                    if( this._debug.offsetX>=0.99 ) {
                        this._debug.offsetX = 1;
                        this.tweenFlag = false;
                        this._debug.hide();
                    }
                }

                return;
            }

            // touch
            if( this.tracking.ave == null ) this.tracking.ave = { x:this.tracking.vec.x, y:this.tracking.vec.y };
            this.tracking.ave.x = this.tracking.ave.x/2 + this.tracking.vec.x/2;
            this.tracking.ave.y = this.tracking.ave.y/2 + this.tracking.vec.y/2;

            if( this.state === OPENING && this.tracking.onScreen == true ) {
                var val = this.tracking.vec.x / window.innerWidth;
                if( this.startAcc.index>=0 ) {
                    val += this.startAcc.vecs[ this.startAcc.index ];
                    this.startAcc.index++;
                    if( this.startAcc.vecs.length<=this.startAcc.index ) this.startAcc.index = -1;
                }
                this._debug.offsetX += val;

            } else if( this.state === CLOSING && this.tracking.onScreen != true ) {
                var val = this.tracking.ave.x / window.innerWidth;
                if( val > 0.05 ) {
                    this.close();
                }
            }
            this.tracking.vec = {x:0, y:0};
        }}
    });


    var nativeConsoleLog = console.log;
    var nativeOnUncaughtError = window.onUncaughtError;

    var Debugger = Class( Object, {

        initialize: { value: function(){
            // display
            this._stage = new Stage(100,100);
            this._layer = new Layer( this._stage );
            this._layer.alpha = 0.7;
            // tiny
            this._tiny = new TinyGL(100,100);
            this._tinyLayer = new Layer( this._tiny );
            this._bg = new TinyGLRectangle().addTo( this._tiny).colors(0xbb000000).tl(0,0).br(100,100);

            // view
            this._logView = new LogView( this._tiny ).addTo( this._stage );
            this._textureView = new TextureView( this ).addTo( this._stage).hide();// TODO
            this._graphView = new GraphView( this._tiny ).addTo( this._stage );
            this._buttonList = new View().addTo( this._stage );
            this._footer = new FooterView( this._tiny ).addTo( this._stage );
            this._pullTab = new PullTab(this);// TODO 単体のLayerか？

            // listeners
            this._onOrientationChange = null;
            this._onEnterFrame = null;
            this._onLoadImage = null;
            this._onTouch = null;

            // touch
            this.tracking = { prev:null, vec: {x:0, y:0} };

            //
            this._isShown = false;

            // prepare..
            var self = this;
            (function(){
                var img = new Image();
                img.src = 'data:image/png;base64,'
                    +'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';
                img.onload = function() {
                    console.log('aaaaaas');
                    self._onLoadImage(this);
                    self._onLoadImage = null;
                };
            })();

            this._onLoadImage = function(img){
                console.log('aaa');
                var bd = new BitmapData( img );
                var btn = null;
                var bgbd = new BitmapData( 1,1,true, 0x00000000 );
                var bmp = null, spacer = null;
                var self = this;
                var ct = new ColorTransform(1,1,1,0.4,255,255,255,0);

                this._logView._shareLoadedBitmapData( bd );
                this._footer._shareLoadedBitmapData( bd );

                // logBtn
                btn = new ButtonView().addTo( this._buttonList.container );
                spacer = btn.container.addChild( new Bitmap( bgbd ) );
                spacer.width = spacer.height = 50;
                bmp = btn.container.addChild( new Bitmap( bd, true, true, new Rectangle(47,0,45,40) ) );
                //bmp.transform.colorTransform = ct;
                bmp.x = 3;
                bmp.y = 5;
                btn.container.width = btn.container.height = 100;
                btn.onTap = function(){ self._textureView.hide(); self._logView.show(); };
                btn.container.x = 0;
                btn.container.y = 0;

                // textureBtn
                btn = new ButtonView().addTo( this._buttonList.container );
                spacer = btn.container.addChild( new Bitmap( bgbd ) );
                spacer.width = spacer.height = 50;
                bmp = btn.container.addChild( new Bitmap( bd, true, true, new Rectangle(0,0,44,40) ) );
                //bmp.transform.colorTransform = ct;
                bmp.x = 3;
                bmp.y = 5;
                btn.container.width = btn.container.height = 100;
                btn.onTap = function(){
                    self._logView.hide();
                    if( self._textureView.isShown ) {
                        self._textureView.next();
                    } else {
                        self._textureView.show();
                    }
                };
                btn.container.x = 100;
                btn.container.y = 0;

                // reloadBtn
                btn = new ButtonView().addTo( this._buttonList.container );
                spacer = btn.container.addChild( new Bitmap( bgbd ) );
                spacer.width = spacer.height = 22;
                bmp = btn.container.addChild( new Bitmap( bd, true, true, new Rectangle(15,44,18,18) ) );
                //bmp.transform.colorTransform = ct;
                bmp.x = 2;
                bmp.y = 2;
                btn.container.width = btn.container.height = 100;
                btn.onTap = function(){ location.reload(); };
                btn.container.x = 0;
                btn.container.y = 100;

                // gcBtn
                var btn = new ButtonView().addTo( this._buttonList.container );
                spacer = btn.container.addChild( new Bitmap( bgbd ) );
                spacer.width = spacer.height = 22;
                bmp = btn.container.addChild( new Bitmap( bd, true, true, new Rectangle(34,43,16.5,20) ) );
                //bmp.transform.colorTransform = ct;
                bmp.x = 1;
                bmp.y = 1;
                btn.container.width = btn.container.height = 100;
                btn.onTap = function(){ app.gc(); };
                btn.container.x = 100;
                btn.container.y = 100;

            };
        }},

        orientationIsHorizontal:{
            get:function(){ return (window.innerWidth > window.innerHeight) }
        },

        offsetX:{
            get:function(){ return this._layer.offsetX; },
            set:function(val){
                this._layer.offsetX = this._tinyLayer.offsetX = val;
                this._textureView.offsetX = this._layer.offsetX;
            }
        },

        isShown: {
            get:function(){ return this._isShown; }
        },

        show: { value: function(){
            if( this.isShown ) return;
            this._isShown = true;
            // show
            window.addLayer( this._tinyLayer );
            window.addLayer( this._layer );
            // events
            var self = this;
            window.addEventListener( 'orientationchange', ( this._onOrientationChange = function(){ setTimeout(function(){self._layOut();},1000); } ) );
            this._stage.addEventListener( 'enterFrame',( this._onEnterFrame = function(e){ self.onEnterFrame(e); } ) );

            this._logView.show();
            this._layOut();

        }},

        hide: { value: function(){
            if( !this.isShown ) return;
            this._isShown = false;
            // hide
            window.removeLayer( this._layer );
            window.removeLayer( this._tinyLayer );
            // events
            window.removeEventListener( 'orientationchange', this._onOrientationChange );
            this._stage.removeEventListener( 'enterFrame', this._onEnterFrame );
            this._onOrientationChange = null;

            // view
            this._logView.hide();
            this._textureView.hide();
        }},

        log:{ value: function(){
            this._logView.log.apply( this._logView, arguments );
            nativeConsoleLog.apply( console, arguments );
        }},

        onEnterFrame:{ value:function(e){
            this._graphView.notifyEnterFrame(e);
            this._pullTab.notifyEnterFrame(e);
        }},


        onUncaughtError:{ value: function(){
            this._logView.onUncaughtError.apply( this._logView, arguments );
            this.show();
            nativeOnUncaughtError.apply( window, arguments );
        }},

        _layOut: { value: function(){
            //
            var footHeight = 30;
            //
            var width;
            var height;
            if( this.orientationIsHorizontal ) {
                // 横向き
                var width = 640 * ( window.innerWidth / window.innerHeight ) * 2/3;
                var height = 640 * 2/3;

                this._tiny.width = this._stage.stageWidth = width;
                this._tiny.height = this._stage.stageHeight = height;
                this._bg.br( width, height );

                this._logView.offset(0,0).resize( width*3/5, height - footHeight );
                this._textureView.offset(0,0).resize( width*3/5, height - footHeight );
                this._graphView.offset(width*3/5,0).resize( width*2/5, height/2 );
                this._buttonList.offset(width*3/5,height/2);
                this._footer.offset(0, height - footHeight).resize( width, footHeight );
            } else {
                // 縦向き
                var width = 640 * 2/3;
                var height = 640 * ( window.innerHeight / window.innerWidth ) * 2/3;

                this._tiny.width = this._stage.stageWidth = width;
                this._tiny.height = this._stage.stageHeight = height;
                this._bg.br( width, height );

                this._logView.offset(0,0).resize( width, height*3/5 );
                this._textureView.offset(0,0).resize( width, height*3/5 );
                this._graphView.offset(width/2,height*3/5).resize( width/2, height*2/5 - footHeight );
                this._buttonList.offset(0,height*3/5);
                this._footer.offset(0, height - footHeight).resize( width, footHeight );
            }
        }}

    });

    var instance = new Debugger();

    console.log = function(){ instance.log.apply( instance, arguments );};
    window.onUncaughtError = function(){ instance.onUncaughtError.apply( instance, arguments );};

    if( window.devtools ) {
        window.devtools.view = instance;
    } else {
        window.debug = instance;
    }

})();

(function(){

    var inspector = devtools.inspector;
    inspector.start();

    var Loader = function() {
        var len = arguments.length,c= 0,self=this;
        this.cnt=function(){ c++;if(c>=len) this.onload() };
        for(var i=0; i<len;i++)
            new Script(arguments[i]).onload=function(){self.cnt();};
    }

    console.log("local!!");

    function notify( notification, flg ) {
        var msg = JSON.stringify(notification);
        //if(flg!==false) console.log( "notify " + msg );
        app.nativeLog("inspector.send notify "+(notification.method?notification.method:""));
        inspector.send( msg );
    }

    var ROOT = window.INSPECTOR || "http://herlock.nb.sonicmoov.net/inspector/";
    var DEVROOT = ROOT+"device/";
    var AGENTROOT = ROOT+"device/agents/";


    new Loader(
        DEVROOT+ "helpers.js",

        AGENTROOT+ "DebuggerAgent.js",
        AGENTROOT+ "InspectorAgent.js",
        AGENTROOT+ "PageAgent.js",
        AGENTROOT+ "TimelineAgent.js",
        AGENTROOT+ "WorkerAgent.js",
        AGENTROOT+ "RuntimeAgent.js",
        AGENTROOT+ "ConsoleAgent.js",
        AGENTROOT+ "ProfilerAgent.js",
        AGENTROOT+ "DOMStorageAgent.js",
        AGENTROOT+ "DOMAgent.js"
    ).onload = function(){};


    // ブラウザにリロードを促す
    location.onreload = function(){
        notify( { method:"Inspector.reload", params:{} } );
    };

    var v8Client = null;

    var agents = {};
    function getAgent( key ){
        var name = key + "Agent";
        if( !agents[name] && window[name] ) agents[name] = new window[name]( notify, v8Client );
        if( !agents[name] ) console.log( name + " is not found!" );
        return agents[name];
    }
    inspector.getAgent = getAgent;

    // client message　受け入れ&Agentへ流す
    inspector.onMessage = function(message){
        app.nativeLog( "inspector.onMessage" );
        var data;
        try{
            app.nativeLog( "inspector.onMessage JSON.parse" );
            data = JSON.parse( message );
        } catch (e){
            console.log( e );
            //throw e;
        }
        var key = data.method.split(".")[0];
        var method = data.method.split(".")[1];
        var id = data.id;
        var params = data.params;

        var agent = getAgent( key );

        if( !agent[ method ] ) {
            console.log( data.method + " is not found!" );
        }

        agent[ method ]( params, function(result) {
            var msg = JSON.stringify( { id: id, result: result } );
            app.nativeLog( "inspector.send "+ method +"id:"+id );
            inspector.send( msg );
        });

    };




})()
(function () {
    function f(b, a) {
        var l = JSON.stringify(b);
        app.nativeLog("inspector.send notify " + (b.method ? b.method : ""));
        d.send(l)
    }

    function h(b) {
        b += "Agent";
        !e[b] && window[b] && (e[b] = new window[b](f, m));
        e[b] || console.log(b + " is not found!");
        return e[b]
    }

    var d = devtools.inspector;
    d.start();
    console.log("local!!");
    var k = window.INSPECTOR || "http://herlock.nb.sonicmoov.net/inspector/", a = k + "device/agents/";
    (new function () {
        var b = arguments.length, a = 0, d = this;
        this.cnt = function () {
            a++;
            if (a >= b)this.onload()
        };
        for (var c = 0; c <
            b; c++)(new Script(arguments[c])).onload = function () {
            d.cnt()
        }
    }(k + "device/helpers.js", a + "DebuggerAgent.js", a + "InspectorAgent.js", a + "PageAgent.js", a + "TimelineAgent.js", a + "WorkerAgent.js", a + "RuntimeAgent.js", a + "ConsoleAgent.js", a + "ProfilerAgent.js", a + "DOMStorageAgent.js", a + "DOMAgent.js")).onload = function () {
    };
    location.onreload = function () {
        f({method:"Inspector.reload", params:{}})
    };
    var m = null, e = {};
    d.getAgent = h;
    d.onMessage = function (b) {
        app.nativeLog("inspector.onMessage");
        var a;
        try {
            app.nativeLog("inspector.onMessage JSON.parse"),
                a = JSON.parse(b)
        } catch (e) {
            console.log(e)
        }
        var c = a.method.split(".")[0], g = a.method.split(".")[1], f = a.id;
        b = a.params;
        c = h(c);
        c[g] || console.log(a.method + " is not found!");
        c[g](b, function (a) {
            a = JSON.stringify({id:f, result:a});
            app.nativeLog("inspector.send " + g + "id:" + f);
            d.send(a)
        })
    }
})();
