(function(){

    // 国際化

    function getLang(){
        return (navigator.userLanguage||navigator.browserLanguage||navigator.language).substr(0,2);
    };



    var i18n = {

        "ja": {
            "":""
            // common
            ,"Only enable for this session": "このセッションでのみ有効"
            ,"Always enable": "常に有効"
            ,"This feature is only available for Android devices.": "※この機能はAndroid端末でのみご利用いただけます。"

            // scripts
            ,"You need to enable debugging before you can use the Scripts panel.": "　　　　実行中のプログラムを　　　　　デバッグしてみましょう。"
            ,"Enable Debugging": "デバッグを有効化する"

            // profiles
            ,"You need to enable profiling before you can use the Profiles panel.": "　　　プロファイリング機能で　　　　　プログラムを最適化しましょう。　"
            ,"Enable Profiling": "プロファイリングを有効化する"
            ,"Enabling profiling will make scripts run slower.": "※スクリプトの実行速度が遅くなる可能性があります。"
            ,"Profiling enabled. Click to disable.": "プロファイリング機能を無効化する"
            ,"Profiling disabled. Click to enable.": "プロファイリング機能を有効化する"
            ,"Clear all profiles.": "クリア"
            //  CPU profiles
            ,"CPU PROFILES": "CPUプロファイル"
            ,"Start profiling.":"CPUプロファイリングを開始する"
            ,"Stop profiling.":"CPUプロファイリングを停止する"
            ,"Control CPU profiling by pressing the %s button on the status bar.": "サイドバー下部の%sボタンでCPUのプロファイリングを開始します。"
            //  heap snapshot
            ,"HEAP SNAPSHOTS": "Heapスナップショット"
            ,"Take heap snapshot.": "Heapスナップショットを取得する"
            ,"Get a heap snapshot by pressing the %s button on the status bar.": "%sボタンでHeapスナップショットが取得できます。"

        }

    }


    window.localizedStrings = i18n[ getLang() ];

})();