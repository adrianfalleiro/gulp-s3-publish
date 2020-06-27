# gulp-s3-publish [![NPM version][npm-image]][npm-url]

> s3 plugin for [gulp](https://github.com/gulpjs/gulp)

## Info
This plugin is a fork of [gulp-s3](https://github.com/nkostelnik/gulp-s3), which was unmaintained when this repository was forked.

This plugin adds support for AWS Signature V4 (which is mandatory for the newer regions), produces Streams2/3 compatible streams and will also error on upload failure, which can be useful in CI/CD environments

Please open an issue for feature requests.

## Usage

First, install `gulp-s3-publish` and `aws-sdk` as a development dependency:

```shell
npm install --save-dev gulp-s3-publish aws-sdk
```

Then, use it in your `Gulpfile.js`:
```javascript
const { upload, clean } = require('gulp-s3-publish');
const { S3 } = require('aws-sdk'); 

const client = S3();
const uploadOpts = {
  bucket: 'my-s3-bucket';
};

const cleanOpts = {
  bucket: 'my-s3-bucket';
};

// Upload files to S3
gulp.task('deploy', () => {
  return gulp.src('./dist/**/*'
    .pipe(upload(client, uploadOpts));
});

// Clean unused files in bucket
gulp.task('deploy-clean', () => {
  return gulp.src('./dist/**/*')
    .pipe(clean(client, cleanOpts));
});
```

## License

[MIT License](http://en.wikipedia.org/wiki/MIT_License)

[npm-url]: https://npmjs.org/package/gulp-s3-publish
[npm-image]: https://badge.fury.io/js/gulp-s3-publish.png
