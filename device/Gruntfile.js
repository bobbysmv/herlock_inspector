module.exports = function(grunt) {
    'use strict';

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        // ファイル結合の設定
        concat: {
            dist: {
                src: [ '*.js', '**/*.js', '!node_modules/**', '!output/**', '!Gruntfile.js' ],
                dest: 'output/<%= pkg.name %>.js'
            }
        },

        // ファイル圧縮の設定
        uglify: {
            options: {
                banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
            },
            build: {
                src: 'output/<%= pkg.name %>.js',
                dest: 'output/<%= pkg.name %>.min.js'
            }
        }
    });

    // プラグインのロード
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');

    // デフォルトタスクの設定
    grunt.registerTask('build', [ 'concat', 'uglify' ]);

};