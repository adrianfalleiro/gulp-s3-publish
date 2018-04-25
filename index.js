'use strict';

const through = require('through2-concurrent');
const mime = require('mime');
const assign = require('lodash.assign');
const AWS = require('aws-sdk');
const PluginError = require('plugin-error');
const log = require('fancy-log');
const colors = require('ansi-colors');

const defaultMimeType = 'text/plain'; // eslint-disable-line
const PLUGIN_NAME = 'gulp-s3-publish';

const plugin = (aws, opts) => {
  const defaults = {
    delay: 0,
    maxoncurrency: 1
  };

  const options = assign({}, defaults, opts);
  options.maxConcurrency = options.concurrency;

  const client = new AWS.S3({
    apiVersion: '2006-03-01',
    accessKeyId: aws.key,
    secretAccessKey: aws.secret,
    region: aws.region
  });

  const regexGzip = /\.([a-z0-9]{2,})\.gz$/i;
  const regexGeneral = /\.([a-z0-9]{2,})$/i;

  return through.obj(options, function (file, encoding, callback) {
    if (file.isNull()) {
      return callback(null, file);
    }

    if (file.isStream()) {
      this.emit('error', new PluginError(PLUGIN_NAME, 'Streams not supported!'));
    }

    try {
      let uploadPath = file.path.replace(file.base, options.uploadPath || '')
        .replace(new RegExp('\\\\', 'g'), '/');

      // Explicitly set headers
      // Else default to public access for all files
      const uploadParams = assign({}, options.headers);
      uploadParams.ACL = (options.acl) ? options.acl : 'public-read';

      if (regexGzip.test(file.path)) {
        // Set proper encoding for gzipped files, remove .gz suffix
        uploadParams.ContentEncoding = 'gzip';
        uploadPath = uploadPath.substring(0, uploadPath.length - 3);
      } else if (options.gzippedOnly) {
        // Ignore non-gzipped files
        return callback(null, file);
      }

      // Set content type based of file extension
      if (!uploadParams.ContentType && regexGeneral.test(uploadPath)) {
        uploadParams.ContentType = mime.getType(uploadPath) || defaultMimeType;
        if (options.encoding) {
          uploadParams.ContentType += '; charset=' + options.encoding;
        }
      }

      // Prepare upload callback
      const uploadCallback = function (err) {
        if (err) {
          this.emit('error', new PluginError(PLUGIN_NAME, err.toString()));
          callback(new PluginError(PLUGIN_NAME, err.toString()));
        } else {
          log(colors.green('[SUCCESS] ' + file.path + ' -> ' + aws.bucket + '/' + uploadPath));
        }

        callback(null, file);
      };

      // Lets Upload
      uploadParams.Bucket = aws.bucket;
      uploadParams.Key = uploadPath;
      uploadParams.Body = file.contents;
      client.putObject(uploadParams, uploadCallback);
    } catch (err) {
      this.emit('error', new PluginError(PLUGIN_NAME, err.toString()));
    }
  });
};

module.exports = plugin;
