(function(){

    var ns = devtools.internal;
    var View = devtools.internal.View;

    devtools.internal.MenuView = ns.Class( View, {

        initialize: { value: function( context ){
            View.prototype.initialize.apply(this, arguments);
            this.container.name = "menu_view";

            this._movableContainer = this.container.addChild( new Sprite() );

            //
            var items = [
                { name: "show log", icon: ns.artwork.log, message: "showLog", func: null },
                { name: "show texture", icon: ns.artwork.texture, message: "showTexture", func: null },
                { name: "execute gc", icon: ns.artwork.gc, message: "executeGC", func: function(){ app.gc(); } },
                { name: "reload", icon: ns.artwork.reload, message: "reload", func: function(){ location.reload(); } },
                { name: "change project", icon: ns.artwork.change, message: "changeProject", func: null },
                { name: "logout", icon: ns.artwork.logout, message: "logout", func: null }
            ];

            //
            this._handle = new ns.PullHandle( context ).addTo( this._movableContainer );

            //
            this.bg = this._movableContainer.addChildAt( ns.artwork.black, 0 );
            this.bg.alpha = 0.3;

            var self = this;

            // menus
            this.menus = [];
            for( var i = 0, len = items.length; i < len; i++ ) {
                var item = items[i];
                var menu = new ns.ButtonView( context ).addTo( this._movableContainer );
                menu.item = item;
                var icon = menu.container.addChild( item.icon );
                icon.x = -icon.width / 2;
                icon.y = -icon.height / 2;
                menu.onTap = function(){
                    self.context.message( this.item.message );
                    if( this.item.func ) this.item.func();
                };
                this.menus.push( menu );
            }

            // events

            var self = this;
            this._handle.onChangeValue = function(value){
                //console.log("menu.onVal " + value);
                // update offset

                self._movableContainer.x = value * self._handle.area.size;
                self.resize( self.rect.width, self.rect.height );
                return true;
            };
            this._handle.onChangeState = function(state){

            };
            this._handle.onFlickToLeft = function(){
                //console.log("menu.onFlickLeft");
                this.open();
            };
            this._handle.onFlickToRight = function(){
                this.close();
            };
            this._handle.onTouchEnd = function(){
                if( this.state === ns.PullHandle.State.WAIT )
                    this.offsetPercent < 0.5? this.open(): this.close();
            };

            // init やっつけ
            setTimeout(function(){ self._handle.onChangeValue( 1.0 ); }, 100 );

        }},

        // TODO offset override


        resize: { value: function( width, height ){
            View.prototype.resize.apply( this, arguments );

            //console.log( this.menus );

            var handleSize = 80;

            //var globalPoint = this._movableContainer.localToGlobal( new Point(0,0) );

            //var handleOffset = this._handle.offsetPercent * this._handle.area.size;

            if( this.context.orientationIsHorizontal ) {
                // 横

                // handle
                this._handle.offset( this._handle.container.width , height / 2 ).resize( handleSize/2, handleSize );
                var w = width - this._handle.container.width;
                var h = height;

                // bg
                this.bg.x = handleSize/2;
                this.bg.y = 0;
                this.bg.width = width;
                this.bg.height = height;

                var xi, yi;
                var rows = 2;// TODO
                // menu
                for( var i = 0, len = this.menus.length; i < len; i++ ) {
                    // TODO
                    var menuButton = this.menus[i];
                    xi = i % (len/rows);
                    yi = Math.floor( i / (len/rows) );
                    menuButton.offset( this._handle.container.width + w * (xi+0.5) / (len/rows+0), height * ( (1+yi)/(1+rows) ) );
                }

                this._handle.setArea(0, w );
                this._movableContainer.x = this._handle.offsetPercent * this._handle.area.size;

            } else {
                // 縦

                // handle
                this._handle.offset( this._handle.container.width , height / 2 ).resize( handleSize/2, handleSize );
                var w = width - this._handle.container.width;

                // bg
                this.bg.x = handleSize/2;
                this.bg.y = (height-handleSize)/2;
                this.bg.width = width;
                this.bg.height =  handleSize ;

                var xi;
                // menu
                for( var i = 0, len = this.menus.length; i < len; i++ ) {
                    var menuButton = this.menus[i];
                    xi = i;
                    menuButton.offset( this._handle.container.width + w * (xi+0.5) / (len+0), height / 2 );
                }

                this._handle.setArea(0, width - this._handle.container.width );
                this._movableContainer.x = this._handle.offsetPercent * this._handle.area.size;
            }

            return this;
        }}



    });

})();