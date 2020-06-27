import * as through from 'through2-concurrent';
import { green } from 'ansi-colors';
import * as PluginError from 'plugin-error';
import { getType } from 'mime';
import * as log from 'fancy-log';
import { S3 } from 'aws-sdk'
import { TransformFunction } from 'through2';

const defaultMimeType = 'text/plain'; // eslint-disable-line
const PLUGIN_NAME = 'gulp-s3-publish/upload';

export interface UploadOpts {
  uploadPath: string;
  bucket: string;
  delay?: number;
  maxConcurrency?: number;
  extraS3PutObjectParams?: Partial<S3.PutObjectRequest>;
  dryRun?: boolean;
}

const defaults: Partial<UploadOpts> = {
  extraS3PutObjectParams: {},
  dryRun: false,
};

export function upload(client: S3, userOptions: UploadOpts) {
  const options: UploadOpts = Object.assign({}, defaults, userOptions);

  const transform: TransformFunction = async function(file, _, callback) {
    if (file.isNull()) {
      return callback(null, file);
    }

    if (file.isStream()) {
      return callback(new PluginError(PLUGIN_NAME, 'Streams not supported!'));
    }

    const uploadPath = file.path
      .replace(file.base, options.uploadPath || '')
      .replace(new RegExp('\\\\', 'g'), '/');

    const uploadParams: Partial<S3.Types.PutObjectRequest> = options.extraS3PutObjectParams;
    uploadParams.Bucket = options.bucket;
    uploadParams.ContentType = getType(file.path) || defaultMimeType;
    uploadParams.Key = uploadPath;
    uploadParams.Body = file.contents;

    try {
      if (!options.dryRun) {
        await client.putObject(uploadParams as S3.Types.PutObjectRequest).promise();
      }
      log(green(`${file.path} -> ${uploadParams.Bucket}/${uploadPath}`));
      return callback(null, file);
    } catch (err) {
      this.emit('error', new PluginError(PLUGIN_NAME, err.toString()));
    }
  }

  return through.obj(options, transform);
};
