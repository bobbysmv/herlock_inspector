(function(){

    var ns = devtools.internal;
    var View = devtools.internal.View;

    devtools.internal.SubPanel = devtools.internal.Class( View, {

        initialize: { value: function( context ){
            View.prototype.initialize.apply(this, arguments);
            this.container.name = "sub_panel";
            this._graphView = new ns.GraphView( context ).addTo( this.container );

            //this.border = new TinyGLRectangle().addTo(this.tiny).colors(0x99000000).tl(0,0).br(10,10);
            this._border = this.container.addChild( ns.artwork.black );
            this._border.alpha = 0.5;

            this._menuView = new ns.MenuView( context ).addTo( this.container );
        }},


        resize: { value: function( width, height ){
            View.prototype.resize.call( this, width, height );

            // TODO layout
            this._graphView.resize( width, height );
            this._menuView.resize( width, height );

            var globalPoint = this.container.localToGlobal( new Point( 0, 0 ) );


            if( this.context.orientationIsHorizontal ) {
                // 横
                var borderHeight = 10;
                this._graphView.offset(0,0).resize( width, height/2 );
                //this.border.tl( globalPoint.x, height/2+globalPoint.y ).br( globalPoint.x + width, height/2+globalPoint.y + borderHeight );
                this._border.y = height/2;
                this._border.width = width;
                this._border.height = borderHeight;

                this._menuView.offset(0, height/2+borderHeight).resize( width, height/2-borderHeight );
            } else {
                // 縦
                var borderHeight = 5;
                this._graphView.offset(0,0).resize( width, height/2 );
                this._border.y = height/2;
                this._border.width = width;
                this._border.height = borderHeight;
                this._menuView.offset(0, height/2+borderHeight).resize( width, height/2-borderHeight );
            }

            return this;
        }}

    });

})();