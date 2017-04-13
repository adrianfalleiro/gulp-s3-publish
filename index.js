'use strict';

// Deps

var gutil = require('gulp-util');
var through2Concurrent = require('through2-concurrent');
var mime = require('mime');
var assign = require('lodash.assign');
var AWS = require('aws-sdk');

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

    var client = new AWS.S3({
        apiVersion: '2006-03-01',
        accessKeyId: aws.key,
        secretAccessKey: aws.secret,
        region: aws.region,
    });

    var waitTime = 0;
    var regexGzip = /\.([a-z0-9]{2,})\.gz$/i;
    var regexGeneral = /\.([a-z0-9]{2,})$/i;

    return through2Concurrent.obj({ maxConcurrency: options.concurrency }, function (file, enc, cb) {

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
                : { ACL : 'public-read' }

            if (regexGzip.test(file.path)) {
                // Set proper encoding for gzipped files, remove .gz suffix
                headers['ContentEncoding'] = 'gzip';
                uploadPath = uploadPath.substring(0, uploadPath.length - 3);
            } else if (options.gzippedOnly) {
                // Ignore non-gzipped files
                return cb(null, file);
            }

            // Set content type based of file extension
            if (!headers['ContentType'] && regexGeneral.test(uploadPath)) {
                headers['ContentType'] = mime.lookup(uploadPath);
                if (options.encoding) {
                    headers['ContentType'] += '; charset=' + options.encoding;
                }
            }

            headers['ContentLength'] = file.stat.size;

            // Prepare upload callback
            var uploadCallback = function(err, res){
                if (err) {
                    cb(new gutil.PluginError('gulp-s3-publish', "[" + res.statusCode + "] " + file.path + " -> " + uploadPath));

                } else {
                    gutil.log(gutil.colors.green('[SUCCESS]', file.path + " -> " + uploadPath));
                }

                cb(null, file);
            }

            // Lets Upload

            headers['Bucket'] = aws.bucket;
            headers['Key'] = uploadPath;
            headers['Body'] = file.contents;
            client.putObject(headers, uploadCallback);

        } catch (err) {
            this.emit('error', new gutil.PluginError('gulp-s3-publish', err.toString()));
        }
    });
}
