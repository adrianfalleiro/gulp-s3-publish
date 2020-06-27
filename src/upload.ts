import * as through from 'through2-concurrent';
import * as colors from 'ansi-colors';
import * as PluginError from 'plugin-error';
import mime from 'mime';
import log from 'fancy-log';
import { S3 } from 'aws-sdk'
import { TransformFunction } from 'through2';

const defaultMimeType = 'text/plain'; // eslint-disable-line
const PLUGIN_NAME = 'gulp-s3-publish/upload';

export interface UploadOpts {
  delay: number;
  maxConcurrency: number;
  uploadPath: string;
  s3PutObjectParams: Omit<S3.PutObjectRequest, 'Key' | 'Body'>;
  s3ClientOpts: S3.Types.ClientConfiguration;
}

const defaults: Partial<UploadOpts> = {
  delay: 0,
  maxConcurrency: 1,
  s3ClientOpts: {}
};

export function upload(userOptions: UploadOpts) {
  const options: UploadOpts = Object.assign({}, defaults, userOptions);

  const client = new S3({
    apiVersion: '2006-03-01',
    ...options.s3ClientOpts
  });

  const transform: TransformFunction = async function(file, _, callback) {
    if (file.isNull()) {
      return callback(null, file);
    }

    if (file.isStream()) {
      this.emit('error', new PluginError(PLUGIN_NAME, 'Streams not supported!'));
    }

    const uploadPath = file.path
      .replace(file.base, options.uploadPath || '')
      .replace(new RegExp('\\\\', 'g'), '/');

    const uploadParams: Partial<S3.Types.PutObjectRequest> = options.s3PutObjectParams;
    uploadParams.ContentType = mime.getType(uploadPath) || defaultMimeType;
    uploadParams.Key = uploadPath;
    uploadParams.Body = file.contents;

    try {
      await client.putObject(uploadParams as S3.Types.PutObjectRequest).promise();
      log(colors.green(`[SUCCESS] ${file.path} -> ${uploadParams.Bucket}/${uploadPath}`));
      callback(null, file);
    } catch (err) {
      this.emit('error', new PluginError(PLUGIN_NAME, err.toString()));
      callback(new PluginError(PLUGIN_NAME, err.toString()));
    }
  }

  return through.obj(options, transform);
};
