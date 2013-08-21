(function(){

    var ns = devtools.internal;
    var View = devtools.internal.View;

    devtools.internal.TextureView = devtools.internal.Class( View, {

        initialize: { value:function( context ){
            View.prototype.initialize.apply(this, arguments);
            this.container.name = "texture_view";


            // display
            this.tf = new TextField();
            this.container.addChild( this.tf );
            this.tf.text = "0/0";
            this.tf.autoSize = "left";
            this.tf.defaultTextFormat = new TextFormat(null, 20, 0xffffff );
            //this.tf.background = true;
            //this.tf.backgroundColor = 0x000000;
            this.tf.alpha = 1.0;

            this._arrowLeft = new ns.ButtonView( this.context ).addTo( this.container );
            var bmp = this._arrowLeft.container.addChild( ns.artwork.arrow_left );
            bmp.x = -bmp.width/2;
            bmp.y = -bmp.height/2;

            this._arrowRight = new ns.ButtonView( this.context ).addTo( this.container );
            bmp = this._arrowRight.container.addChild( ns.artwork.arrow_right );
            bmp.x = -bmp.width/2;
            bmp.y = -bmp.height/2;


            // tiny
            //this._tiny = debug._tiny;
            //this.bg = new TinyGLRectangle().colors(0x88888888);

            this._index = 0;


            this.texView = new GLTextureView(0);
            this.textureLayer = new Layer( this.texView );
            this.textureLayer.alpha = 0.6;

            this.texMatrix = new Matrix();


            this._showTexture(0);

            // event
            var self = this;

            this._arrowLeft.onTap = function(){ self._showTexture(-1); };
            this._arrowRight.onTap = function(){ self._showTexture(+1); };

            this.context.listen( "changeLayerDepth", function(){
                if(!self.isShown) return;
                var index = window.getLayerIndex( self.context._layer );
                window.addLayerAt( self.textureLayer, index-1 );

            } );
            this.context.listen( "changeOffset", function(){
                self.textureLayer.offsetX = self.context.offset;
            });

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
            var index = window.getLayerIndex( this.context._layer );
            window.addLayerAt( this.textureLayer, index-1 );
            this._showTexture(0);
            return this;
        }},

        hide:{value:function(){
            View.prototype.hide.call(this);
            //this.bg.removeFrom( this._tiny );
            window.removeLayer( this.textureLayer );
            return this;
        }},

        offset: { value: function( x, y ){
            View.prototype.offset.call( this, x, y );

            // texLayer
            this.textureLayer.offsetY = y / this.container.stage.stageHeight;

            return this;
        }},

        resize: { value: function( width, height ){
            View.prototype.resize.apply( this, arguments );

            //
            //this.bg.tl( this.rect.x, this.rect.y).br( this.rect.x + this.rect.width, this.rect.y + this.rect.height );

            //
            if( this.context.orientationIsHorizontal ) {
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
                var xscale = this.rect.width * this.context._layer.contentScaleX / this.textureLayer.content.naturalWidth;
                var yscale = this.rect.height * this.context._layer.contentScaleY / this.textureLayer.content.naturalHeight;
                this.texMatrix.a = this.texMatrix.d = Math.min( xscale, yscale );
                this.textureLayer.content.matrix = this.texMatrix;
            }

            // pager

            this.tf.x = width - this.tf.width - 40;
            this.tf.y = height - this.tf.height - 10;
            this._arrowLeft.offset( 1 + this.tf.x - 40 + this.tf.width/2, 1 + this.tf.y + this.tf.height/2 );
            this._arrowRight.offset( 1 + this.tf.x + 40 + this.tf.width/2, 1 + this.tf.y + this.tf.height/2 );

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



})();