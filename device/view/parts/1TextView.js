(function(){

    var View = devtools.internal.View;

    devtools.internal.TextView = devtools.internal.Class( View, {

        initialize: { value: function( context ){
            View.prototype.initialize.call(this, arguments);
            this._tf = new TextField();
            this._tf.autoSize = 'left';
            this._tf.multiline = true;
            this.container.addChild( this.tf );
        }},

        tf: { get: function(){ return this._tf; }},

        setTextFormat: { value: function( fmt ){ this._tf.defaultTextFormat = fmt; }},

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
})();