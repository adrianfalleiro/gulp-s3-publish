const gulp = require('gulp');
const { upload, clean } = require('../src');

gulp.task('upload', function() {
  return gulp.src('../src/*.ts')
    .pipe(upload());
});

gulp.task('clean', function() {
  return gulp.src('../src/*.ts')
    .pipe(clean());
});
