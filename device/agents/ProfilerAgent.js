//var v8debugger = require('v8-v8debugger');
//var fs = require('fs');

var HeapProfileType = 'HEAP';
var CPUProfileType  = 'CPU';

function ProfilerAgent(notify) {
    this.notify = notify;
    this.profiles = {
        HEAP: {},
        CPU: {}
    };

    this.enabled = false;
    this.isProfilingCPU = false;
}

(function(){

    var inspector = devtools.inspector;

    this.enable = function(params, sendResult) {
        // TODO
        this.enabled = app.isANDROID? true: false;
        sendResult({result: this.enabled});

        if( !this.enabled ) return;

        this.notify( {
            method: 'Profiler.profilerWasEnabled',
            params: {}
        });
    };

    this.causesRecompilation = function(params, sendResult) {
        sendResult({result: false});
    };

    this.isSampling = function(params, sendResult) {
        sendResult({result: this.isProfilingCPU});
    };

    this.hasHeapProfiler = function(params, sendResult) {
        sendResult({result: true});
    };

    this.getProfileHeaders = function(params, sendResult) {
        var headers = [];

        for (var type in this.profiles) {
            for (var profileId in this.profiles[type]) {
                var profile = this.profiles[type][profileId];
                headers.push({
                    title: profile.title,
                    uid: profile.uid,
                    typeId: type
                });
            }
        }

        sendResult({
            headers: headers
        });
    };

    this.snapshotCnt = 0;
    this.takeHeapSnapshot = function(params, sendResult) {
        var self = this;
        /*
        var snapshot = inspector.v8debugger.takeSnapshot(function(done, total) {
            self.notify({
                method: 'Profiler.reportHeapSnapshotProgress',
                params:{
                    done: done,
                    total: total
                }
            });
        });
        */
        var snapshot = inspector.v8debugger.takeSnapshot( "njs_snapshot_" + this.snapshotCnt++ );
        /*
         self.notify({
             method: 'Profiler.reportHeapSnapshotProgress',
             params:{
                 done: done,
                 total: total
             }
         });
         */

        this.profiles[HeapProfileType][snapshot.uid] = snapshot;

        this.notify({
            method: 'Profiler.addProfileHeader',
            params: {
                header: {
                    title: snapshot.title,
                    uid: snapshot.uid,
                    typeId: HeapProfileType
                }
            }
        });

        sendResult({});
    };

    this.getHeapSnapshot = function(params, sendResult) {
        var self = this;
        var snapshot = this.profiles[HeapProfileType][params.uid];

        snapshot.serialize(
            function onData(chunk, size) {
                chunk = chunk + '';
                self.notify({
                    method: 'Profiler.addHeapSnapshotChunk',
                    params: {
                        uid: snapshot.uid,
                        chunk: chunk
                    }
                });
            },

            function onEnd() {
                self.notify({
                    method: 'Profiler.finishHeapSnapshot',
                    params: {uid: snapshot.uid}
                });

                sendResult({
                    profile: {
                        title: snapshot.title,
                        uid: snapshot.uid,
                        typeId: HeapProfileType
                    }
                });
            }
        );

        /*
        self.notify({
            method: 'Profiler.addHeapSnapshotChunk',
            params: {
                uid: snapshot.uid,
                chunk: snapshot.serialize()
            }
        });
        self.notify({
            method: 'Profiler.finishHeapSnapshot',
            params: {uid: snapshot.uid}
        });
        sendResult({
            profile: {
                title: snapshot.title,
                uid: snapshot.uid,
                typeId: HeapProfileType
            }
        });
        */
    };

    this.getCPUProfile = function(params, sendResult) {
        var self = this;
        var profile = this.profiles[CPUProfileType][params.uid];
        profile.typeId = CPUProfileType;

        sendResult({
            profile: {
                title: profile.title,
                uid: profile.uid,
                typeId: CPUProfileType,
                head: profile.getTopDownRoot(),
                bottomUpHead: profile.getBottomUpRoot()
            }
        });
    };

    //Backwards support for v8 versions coming in nodejs 0.6.x and 0.8.x
    this.getProfile = function(params, sendResult) {
        if (params.type === HeapProfileType) {
            this.getHeapSnapshot(params, sendResult);
        } else if (params.type === CPUProfileType) {
            this.getCPUProfile(params, sendResult);
        }
    };

    this.clearProfiles = function(params, sendResult) {
        this.profiles.HEAP = {};
        this.profiles.CPU = {};
        inspector.v8debugger.deleteAllSnapshots();
        inspector.v8debugger.deleteAllProfiles();
    };

    this.currentProfileName = null;
    this.profileCnt = 0;
    this.start = function(params, sendResult) {
        /* TODO
         {   "method":"Console.messageAdded",
         "params":{"message":{"source":"javascript","level":"log","text":"Profile \"Profile 1" started.","type":"log","line":0,"url":"","repeatCount":1}}}
         */
        if( this.currentProfileName!==null ) throw new Error( "profiling... " + this.currentProfileName );
        this.currentProfileName = "njs_profile_"+(this.profileCnt++);
        inspector.v8debugger.startProfiling( this.currentProfileName );

        this.notify({
            method: 'Profiler.setRecordingProfile',
            params: {
                isProfiling: true
            }
        });

        sendResult({});
    };

    this.stop = function(params, sendResult) {
        var profile = inspector.v8debugger.stopProfiling( this.currentProfileName );
        this.currentProfileName = null;

        this.profiles[CPUProfileType][profile.uid] = profile;

        this.notify({
            method: 'Profiler.addProfileHeader',
            params: {
                header: {
                    title: profile.title,
                    uid: profile.uid,
                    typeId: CPUProfileType
                }
            }
        });

        this.notify({
            method: 'Profiler.setRecordingProfile',
            params: {
                isProfiling: false
            }
        });

        sendResult({});
    };

    this.collectGarbage = function(params, sendResult) {
        if (typeof gc === 'function') {
            gc();
        } else {
            console.warn('ProfilerAgent: ' +
                'you need to run your nodejs app using --expose_gc ' +
                'in order to `"force`" garbage collection.');
        }
        sendResult({});
    };

}).call(ProfilerAgent.prototype);

