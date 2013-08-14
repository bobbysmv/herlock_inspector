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
