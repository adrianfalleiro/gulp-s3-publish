"use strict";

var gutil = require("gulp-util");
var through2Concurrent = require("through2-concurrent");
var mime = require("mime");
var assign = require("lodash.assign");
var AWS = require("aws-sdk");

mime.default_type = "text/plain";
var PLUGIN_NAME = "gulp-s3-publish";

module.exports = function (aws, opts) {
    
    var defaults = {
        delay: 0,
        concurrency: 1
    };

    var options = assign({}, defaults, opts);

    var client = new AWS.S3({
        apiVersion: "2006-03-01",
        accessKeyId: aws.key,
        secretAccessKey: aws.secret,
        region: aws.region,
    });

    var waitTime = 0;
    var regexGzip = /\.([a-z0-9]{2,})\.gz$/i;
    var regexGeneral = /\.([a-z0-9]{2,})$/i;

    return through2Concurrent.obj({ maxConcurrency: options.concurrency }, function (file, enc, cb) {

        if (file.isNull()) {
            return cb(null, file);
        }

        if (file.isStream()) {
            return cb(new gutil.PluginError(PLUGIN_NAME, "Streaming not supported"));
        }

        try {
            var uploadPath = file.path.replace(file.base, options.uploadPath || "")
               .replace(new RegExp('\\\\', "g"), "/"); 

            // Explicitly set headers
            // Else default to public access for all files
            var uploadParams = assign({}, options.headers);
            uploadParams.ACL = (options.acl) ? options.acl : "public-read";

            if (regexGzip.test(file.path)) {
                // Set proper encoding for gzipped files, remove .gz suffix
                uploadParams.ContentEncoding = 'gzip';
                uploadPath = uploadPath.substring(0, uploadPath.length - 3);
            } else if (options.gzippedOnly) {
                // Ignore non-gzipped files
                return cb(null, file);
            }

            // Set content type based of file extension
            if (!uploadParams.ContentType && regexGeneral.test(uploadPath)) {
                uploadParams.ContentType = mime.lookup(uploadPath);
                if (options.encoding) {
                    uploadParams.ContentType += "; charset=" + options.encoding;
                }
            }

            // Prepare upload callback
            var uploadCallback = function(err, res){
                if (err) {
                    cb(new gutil.PluginError(PLUGIN_NAME, "[ERROR] " + file.path + " -> " + uploadPath));

                } else {
                    gutil.log(gutil.colors.green("[SUCCESS]", file.path + " -> " + aws.bucket + "/" + uploadPath));
                }

                cb(null, file);
            };

            // Lets Upload
            uploadParams.Bucket = aws.bucket;
            uploadParams.Key = uploadPath;
            uploadParams.Body = file.contents;
            client.putObject(uploadParams, uploadCallback);

        } catch (err) {
            this.emit("error", new gutil.PluginError(PLUGIN_NAME, err.toString()));
        }
    });
};
