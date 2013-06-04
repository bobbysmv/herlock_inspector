(function(){

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

    //var ROOT = "http://192.168.2.1:8080/";
    //var ROOT = "http://192.168.32.16:8080/";
    var ROOT = "http://172.20.1.55:8080/";
    //var ROOT = "http://herlock.nb.sonicmoov.net/inspector/"
    var DEVROOT = ROOT+"device/";
    var AGENTROOT = ROOT+"device/agents/";
    var V8ROOT = ROOT+"device/v8/";


    new Loader(
        V8ROOT + "V8DebuggerClient.js",
        DEVROOT+ "helpers.js",
        DEVROOT+ "translator.js",

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
        //if( v8Client===null ) v8Client = new V8DebuggerClient( notify );
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
            data = JSON.parse( message );
        } catch (e){
            console.log( message );
            throw e;
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