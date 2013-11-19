(function(){

    var ns = devtools.internal;
    var View = devtools.internal.View;

    devtools.internal.GraphView = devtools.internal.Class( View, {

        initialize: { value: function(context){
            View.prototype.initialize.apply( this, arguments );
            this.container.name = "graph_view";

            // display
            this.label_fps60 = new TextField();
            this.label_fps60.defaultTextFormat = new TextFormat(null,13,0xffb400);
            this.label_fps60.autoSize = 'left';
            this.label_fps60.text = '60';
            this.container.addChild( this.label_fps60 );
            this.label_fps30 = new TextField();
            this.label_fps30.defaultTextFormat = new TextFormat(null,13,0xffb400);
            this.label_fps30.autoSize = 'left';
            this.label_fps30.text = '30';
            this.container.addChild( this.label_fps30 );

            this.label_mem100 = new TextField();
            this.label_mem100.defaultTextFormat = new TextFormat(null,15,0xff0000,null,null,null,null,null,"right");
//            this.label_mem100.autoSize = 'left';
            this.label_mem100.width = 200;
            this.label_mem100.height = 20;
            this.label_mem100.text = 'mem: m% n / nKB';
            this.container.addChild( this.label_mem100 );

            this.label_doc = new TextField();
            this.label_doc.defaultTextFormat = new TextFormat(null,15,0xffffff);
            //this.label_doc.autoSize = 'left';
            this.label_doc.width = 100;
            this.label_doc.height = 20;
            this.label_doc.text = 'doc:0';
            this.container.addChild( this.label_doc );

            // tiny

            // model
            this.items = {
                memory:{
                    data: ns.createCircularBuffer(20),
                    object: new TinyGLTriangleStrip().colors(0xaaff0000).addTo(this.tiny)
                },
                fps:{
                    data: ns.createCircularBuffer(20),
                    currentCount: 0,
                    prevStamp: null,
                    object: new TinyGLTriangleStrip().colors(0xaaffb400).addTo(this.tiny)
                },
                doc:{
                    data: ns.createCircularBuffer(20),
                    object: new TinyGLTriangleStrip().colors(0xaaffffff).addTo(this.tiny),
                    max: 1
                }
            };

            //
            this.bg = this.container.addChildAt( ns.artwork.black, 0 );
            this.bg.alpha = 0.5;

            // event
            var self = this;
            context.listen( "enterFrame", function(){ self.notifyEnterFrame(); } );
            context.listen( "changeOffset", function(){ self.update(); } );

        }},

        resize: { value: function( width, height ){
            View.prototype.resize.apply( this, arguments );

            var globalPoint = this.container.localToGlobal( new Point( 0, 0 ) );
            var textHeight = 22;

            this.bg.width = width;
            this.bg.height = textHeight;

            this.update();
            this.label_fps30.y = textHeight - this.label_fps30.height/2 + (this.rect.height-textHeight) * ( 1 - 30 / 90 );
            this.label_fps60.y = textHeight - this.label_fps60.height/2 + (this.rect.height-textHeight) * ( 1 - 60 / 90 );

            this.label_doc.y = -1+( textHeight - this.label_doc.height )/2;

            this.label_mem100.y = -1+( textHeight - this.label_mem100.height )/2;
            this.label_mem100.x = width - this.label_mem100.width - 6;
            return this;
        }},

        notifyEnterFrame:{value:function(){
            var timestamp = Date.now();
            if( this.items.fps.prevStamp === null ) this.items.fps.prevStamp = timestamp;
            if( this.items.fps.prevStamp <= (timestamp-1000) ) {

                // sampling
                //  fps
                this.items.fps.data.push( this.items.fps.currentCount );
                this.items.fps.currentCount = 0;
                this.items.fps.prevStamp = timestamp;
                //  mem
                var mem = app.memory;
                this.items.memory.data.push( { used:mem.used, total: mem.total} );
                this.label_mem100.text = "mem: "+ Math.ceil( mem.used / mem.total *100) +"% " + (Math.round(mem.used/(1024*1024))/1) +" / "+ (Math.round(mem.total/(1024*1024))/1) + "MB";
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

            var globalPoint = new Point(this.container.parent.x, this.container.parent.y);//this.container.localToGlobal( new Point( this.container.x, this.container.y ) );
            var textHeight = 22;

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
                points[i*4+0] = globalPoint.x + i * xSpan;
                points[i*4+1] = textHeight + globalPoint.y + 1 + (this.rect.height-textHeight) * ( 1 - data.get(i) / 90 );
                points[i*4+2] = globalPoint.x + i * xSpan;
                points[i*4+3] = textHeight + globalPoint.y - 1 + (this.rect.height-textHeight) * ( 1 - data.get(i) / 90 );
            }
            object.points.apply( object, points );


            // memory
            data = this.items.memory.data;
            object = this.items.memory.object;

            var points = new Array( data.length * 4 );
            for( var i = 0; i < data.length; i++ ) {
                var dat = data.get(i);
                if(dat===0) dat = {used:0,total:100};
                points[i*4+0] = globalPoint.x + i * xSpan;
                //points[i*4+1] = textHeight + globalPoint.y + (this.rect.height-textHeight) * ( 1 - dat.used / dat.total );
                points[i*4+1] = textHeight + globalPoint.y + 1 + (this.rect.height-textHeight) * ( 1 - dat.used / dat.total );
                points[i*4+2] = globalPoint.x + i * xSpan;
                //points[i*4+3] = textHeight + globalPoint.y + (this.rect.height-textHeight) * ( 1 - 0 / dat.total );
                points[i*4+3] = textHeight + globalPoint.y - 1 + (this.rect.height-textHeight) * ( 1 - dat.used / dat.total );
            }
            object.points.apply( object, points );

            // doc
            data = this.items.doc.data;
            object = this.items.doc.object;
            var max = this.items.doc.max;
            var points = new Array( data.length * 4 );
            for( var i = 0; i < data.length; i++ ) {
                points[i*4+0] = globalPoint.x + i * xSpan;
                points[i*4+1] = textHeight + globalPoint.y + 1 + (this.rect.height-textHeight) * ( 1 - data.get(i) / max );
                points[i*4+2] = globalPoint.x + i * xSpan;
                points[i*4+3] = textHeight + globalPoint.y - 1 + (this.rect.height-textHeight) * ( 1 - data.get(i) / max );
            }
            object.points.apply( object, points );

        }}
    });

})();