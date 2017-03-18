'use strict';

// Deps
var knox = require('knox');
var gutil = require('gulp-util');
var through2Concurrent = require('through2-concurrent');
var mime = require('mime');
var assign = require('lodash.assign');

// Defaults
mime.default_type = 'text/plain';

module.exports = function (aws, opts) {
    
    var defaults = {
        delay: 0,
        concurrency: 1
    };

    var options = assign({}, defaults, opts);



    if (!options.delay) { options.delay = 0; }
    if (!options.parallel) { options.parallel = 1; }

    var client = knox.createClient(aws);
    var waitTime = 0;
    var regexGzip = /\.([a-z0-9]{2,})\.gz$/i;
    var regexGeneral = /\.([a-z0-9]{2,})$/i;


    return through2Concurrent.obj({maxConcurrency: options.concurrency}, function (file, enc, cb) {

        if (file.isNull()) {
            return cb(null, file)
        }

        if (file.isStream()) {
            return cb(new gutil.PluginError('gulp-s3-publish', 'Streaming not supported'))
        }

        try {
            var uploadPath = file.path.replace(file.base, options.uploadPath || '')
               .replace(new RegExp('\\\\', 'g'), '/') 


            // Explicitly set headers
            // Else default to public access for all files
            var headers = (options.headers)
                ? options.headers
                : { 'x-amz-acl' : 'public-read' }

            if (regexGzip.test(file.path)) {
                // Set proper encoding for gzipped files, remove .gz suffix
                headers['Content-Encoding'] = 'gzip';
                uploadPath = uploadPath.substring(0, uploadPath.length - 3);
            } else if (options.gzippedOnly) {
                // Ignore non-gzipped files
                return cb(null, file)
            }

            // Set content type based of file extension
            if (!headers['Content-Type'] && regexGeneral.test(uploadPath)) {
                headers['Content-Type'] = mime.lookup(uploadPath);
                if (options.encoding) {
                    headers['Content-Type'] += '; charset=' + options.encoding;
                }
            }

            headers['Content-Length'] = file.stat.size;

            // Prepare upload callback
            var uploadCallback = function(err, res){
                if (err || res.statusCode !== 200) {
                    cb(new gutil.PluginError('gulp-s3-publish', "[" + res.statusCode + "] " + file.path + " -> " + uploadPath))

                } else {
                    gutil.log(gutil.colors.green('[SUCCESS]', file.path + " -> " + uploadPath));
                }

                cb(null, file)  
            }

            // Lets Upload
            client.putBuffer(file.contents, uploadPath, headers, uploadCallback.bind(this))

        } catch (err) {
            this.emit('error', new gutil.PluginError('gulp-s3-publish', err.toString()));
        }
    })
}
