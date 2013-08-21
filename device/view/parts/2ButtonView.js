(function(  ){

    var View = devtools.internal.View;

    devtools.internal.ButtonView = devtools.internal.Class( View, {

        initialize: { value: function(){
            View.prototype.initialize.call(this, arguments);

            this.onTap = null;
            var self = this;
            this.container.addEventListener( 'touchTap', function(){ if( self.onTap ) self.onTap(); });
        }}

    });

})();