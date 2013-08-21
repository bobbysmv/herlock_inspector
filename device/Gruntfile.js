module.exports = function(grunt) {
    'use strict';

    var js_src = [ '*.js', '**/*.js', '!node_modules/**', '!output/**', '!Gruntfile.js' ];

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),


//        // ファイル結合の設定
//        concat: {
//            dist: {
//                src: js_src,
//                dest: 'output/<%= pkg.name %>.js'
//            }
//        },
//
//        // ファイル圧縮の設定
//        uglify: {
//            options: {
//                banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
//            },
//            build: {
//                src: 'output/<%= pkg.name %>.js',
//                dest: 'output/<%= pkg.name %>.min.js'
//            }
//        },

        closurecompiler: {
            minify: {
                files: {
                    // Destination: Sources...
                    "output/devtools.js": js_src
                },
//                options: {
//                    // Any options supported by Closure Compiler, for example:
//                    "compilation_level": "WHITESPACE_ONLY" //"SIMPLE_OPTIMIZATIONS"
//                    , "formatting": "pretty_print"
//                }
                options: {
                    "compilation_level": "SIMPLE_OPTIMIZATIONS"
                }
            }
        },

        watch: {
            files: js_src,
            tasks: 'build'
        }
    });

    // プラグインのロード
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-closurecompiler');

    // デフォルトタスクの設定
    //grunt.registerTask('build', [ 'concat', 'uglify' ]);
    grunt.registerTask('build', [ 'closurecompiler' ]);

};