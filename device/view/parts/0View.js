(function(  ){

    //
    devtools.internal.View = devtools.internal.Class( Object, {

        initialize: { value: function( context ){
            // display
            this._context = context;
            this._container = new Sprite();
            this.rect = {x:0,y:0,width:0,height:0};
        }},

        tiny: { get:function(){ return this._context.tiny; } },

        container: { get:function(){ return this._container; } },

        context: { get:function(){ return this._context; } },

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

})();