// @ts-check
const gulp = require('gulp');
const { upload } = require('../../dist');
const { S3 } = require('mock-aws-s3');
const fs = require('fs');
const mock = require('mock-fs');
const should = require('should');

const client = new S3();
const uploadOpts = {
  bucket: 'test-bucket',
  uploadPath: 'test-path',
}

describe('gulp-s3-publish/upload', () => {

  beforeEach(() => {
    // mock filesystem
    mock({
      'test-bucket': {
        'existing-test-file-1.txt': 'Existing test file 1',
        'test-path': {
          'existing-test-file-2.txt': 'Existing test file 2',
          'existing-test-file-3.txt': 'Existing test file 3',
        }
      },
      'test-src-files': {
        's3-copied-file-1.txt': 'S3 copied file 1',
        's3-copied-file-2.txt': 'S3 copied file 2'
      }
    });
  });

  afterEach(() => {
    mock.restore();
  });


  it('should pass file when it isNull()', done => {
    const stream = upload(client, uploadOpts);
    const emptyFile = {
      isNull: () => true,
    };
    stream.on('data', (data) => {
      should(data).equal(emptyFile);
      done();
    });
    stream.write(emptyFile);
  });

  it('should emit error when file isStream()', done => {
    const stream = upload(client, uploadOpts);
    const streamFile = {
      isNull: () => false,
      isStream: () => true,
    };
    stream.on('error', err => {
      should(err.message).equal('Streams not supported!');
      done();
    });
    stream.write(streamFile);
  });

  it('should successfully upload files', done => {
    const files = []
    gulp.src('./test-src-files/*.txt')
      .pipe(upload(client, uploadOpts))
      .on('data', file => files.push(file))
      .on('error', err => done(new Error(err.message)))
      .on('end', () => {
        files.forEach(file => {
          const path = file.path
            .replace(file.base, uploadOpts.uploadPath || '')
            .replace(new RegExp('\\\\', 'g'), '/');

          should(fs.existsSync(`${uploadOpts.bucket}/${path}`)).equal(true)
        })
        done();
      })
  });
});