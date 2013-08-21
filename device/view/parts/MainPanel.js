(function(){

    var ns = devtools.internal;
    var View = devtools.internal.View;

    devtools.internal.MainPanel = devtools.internal.Class( View, {


    initialize: { value: function( context ){
            View.prototype.initialize.apply(this, arguments);
            this.container.name = "main_panel";

            this._ipTF = this.container.addChild( new TextField() );
            this._ipTF.autoSize = "left";
            this._ipTF.text = "IP:" + app.activeNetworkIP;// TODO 更新のタイミングある？
            this._ipTF.defaultTextFormat = ( new TextFormat( null, 15, 0xffffff ) );

            this._ipBG = this.container.addChildAt( ns.artwork.black, 0 );
            this._ipBG.alpha = 0.5;


            this._logView = new ns.LogView( context ).addTo( this.container );
            this._textureView = new ns.TextureView( context ).addTo( this.container );

            this.showLog();

            // event
            var self = this;
            context.listen( "showLog", function(){ self.showLog(); } );
            context.listen( "showTexture", function(){ self.showTexture(); } );
        }},

        showLog: { value: function(){
            this._logView.show();
            this._textureView.hide();
        }},

        showTexture: { value: function(){
            this._logView.hide();
            this._textureView.show();
        }},

        resize: { value: function( width, height ){
            View.prototype.resize.call( this, width, height );

            var globalPoint = this.container.localToGlobal( new Point(0,0) );

            var textHeight = 22;

            this._ipTF.x = ( width - this._ipTF.width ) / 2;
            this._ipTF.y = -1 + ( textHeight - this._ipTF.height ) / 2;
            this._ipBG.width = width;
            this._ipBG.height = textHeight;

            this._logView.offset(0,textHeight).resize( width, height - textHeight );
            this._textureView.offset(0,textHeight).resize( width, height - textHeight );

            return this;
        }}

    });

})();