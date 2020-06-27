const gulp = require('gulp');
const { clean } = require('../dist');
const { S3 } = require('mock-aws-s3');
const fs = require('fs');
const mock = require('mock-fs');
const should = require('should');

const noop = () => {};

const client = new S3();

const cleanOpts = {
  bucket: 'test-bucket',
  uploadPath: 'test-path',
}

const cleanOptsWithWhitelist = {
  bucket: 'test-bucket',
  uploadPath: 'test-path',
  whitelist: [
    { type: 'keyPrefix', path: 'existing-dir' },
    { type: 'key', path: 'existing-test-file-4.txt' }
  ]
}

describe('gulp-s3-publish/clean', () => {

  beforeEach(() => {
    // mock filesystem
    mock({
      'test-bucket': {
        'existing-test-file-1.txt': 'Existing test file 1',
        'test-path': {
          'existing-dir': {
            'existing-test-file-2.txt': 'Existing test file 2',
            'existing-test-file-3.txt': 'Existing test file 3',
          },
          'existing-test-file-4.txt': 'Existing test file 4',
          'existing-test-file-5.txt': 'Existing test file 5',
          's3-copied-file-1.txt': 'S3 copied file 1',
          's3-copied-file-2.txt': 'S3 copied file 2',
        }
      },
      'test-src-files': {
        's3-copied-file-1.txt': 'S3 copied file 1',
        's3-copied-file-2.txt': 'S3 copied file 2',
      }
    });
  });

  afterEach(() => {
    mock.restore();
  });

  it('should successfully clean non-uploaded files', done => {
    const files = []
    gulp.src('./test-src-files/*.txt')
      .pipe(clean(client, cleanOpts))
      .on('data', file => files.push(file))
      .on('error', err => done(new Error(err.message)))
      .on('end', () => {
        // Expect files to be deleted
        should(fs.existsSync('test-bucket/test-path/existing-dir/existing-test-file-2.txt')).equal(false);
        should(fs.existsSync('test-bucket/test-path/existing-dir/existing-test-file-3.txt')).equal(false);
        should(fs.existsSync('test-bucket/test-path/existing-test-file-4.txt')).equal(false);
        should(fs.existsSync('test-bucket/test-path/existing-test-file-5.txt')).equal(false);

        // Expect files to remain
        should(fs.existsSync('test-bucket/existing-test-file-1.txt')).equal(true);
        should(fs.existsSync('test-bucket/test-path/s3-copied-file-1.txt')).equal(true);
        should(fs.existsSync('test-bucket/test-path/s3-copied-file-2.txt')).equal(true);
        done();
      });
  });

  it('should successfully clean non-uploaded and non-whitelisted files', done => {
    const files = []
    gulp.src('./test-src-files/*.txt')
      .pipe(clean(client, cleanOptsWithWhitelist))
      .on('data', file => files.push(file))
      .on('error', err => done(new Error(err.message)))
      .on('end', () => {
        // Expect files to be deleted
        should(fs.existsSync('test-bucket/test-path/existing-test-file-5.txt')).equal(false);

        // Expect files to remain
        should(fs.existsSync('test-bucket/existing-test-file-1.txt')).equal(true);
        should(fs.existsSync('test-bucket/test-path/s3-copied-file-1.txt')).equal(true);
        should(fs.existsSync('test-bucket/test-path/s3-copied-file-2.txt')).equal(true);
        should(fs.existsSync('test-bucket/test-path/existing-test-file-4.txt')).equal(true);
        should(fs.existsSync('test-bucket/test-path/existing-dir/existing-test-file-2.txt')).equal(true);
        should(fs.existsSync('test-bucket/test-path/existing-dir/existing-test-file-3.txt')).equal(true);
        done();
      });
  });
});