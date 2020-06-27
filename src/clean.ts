import * as through from 'through2-concurrent';
import { TransformFunction, FlushCallback } from 'through2';
import * as PluginError from 'plugin-error';
import { S3 } from 'aws-sdk'
import { chunk } from 'lodash';

const PLUGIN_NAME = 'gulp-s3-publish/clean';

export interface CleanOpts {
  delay: number;
  maxConcurrency: number;
  uploadPath: string;
  whitelist: string[];
  s3ListObjectParams: S3.ListObjectsRequest;
  s3ClientOpts: S3.Types.ClientConfiguration;
}

const defaults: Partial<CleanOpts> = {
  delay: 0,
  maxConcurrency: 1,
  s3ClientOpts: {},
  whitelist: []
};

export function clean(userOptions: CleanOpts) {
  const options: CleanOpts = Object.assign({}, defaults, userOptions);

  const client = new S3({
    apiVersion: '2006-03-01',
    ...options.s3ClientOpts
  });

  const files = [];

  const transform: TransformFunction = function(file, _, callback) {
    if (file.isNull()) {
      return callback();
    }

    if (file.isStream()) {
      this.emit('error', new PluginError(PLUGIN_NAME, 'Streams not supported!'));
    }

    const uploadPath = file.path
      .replace(file.base, options.uploadPath || '')
      .replace(new RegExp('\\\\', 'g'), '/');
  
    files.push(uploadPath);
    return callback();
  }

  const flush: FlushCallback = async function(callback: () => void) {

    // Get all objects in S3
    let objects: S3.ObjectList = [];
    const listParams = options.s3ListObjectParams;
    let response = await client.listObjects(listParams).promise();
    objects = objects.concat(response.Contents)

    while(response.IsTruncated) {
      listParams.Marker = response.NextMarker;
      response = await client.listObjects(listParams).promise();
      objects = objects.concat(response.Contents);
    }

    // Delete old files
    const objectsToDelete = objects
      .filter(object => !files.find(f => f === object.Key))
      .filter(object => !options.whitelist.find(f => f === object.Key));

    for(const objects of chunk(objectsToDelete, 1000)) {
      const keys = objects.map(object => ({ Key: object.Key }));
      const deleteParams: S3.DeleteObjectsRequest = {
        Delete: {
          Objects: keys
        },
        Bucket: listParams.Bucket,
      }

      try {
        await client.deleteObjects(deleteParams).promise();
      } catch (err) {
        this.emit('error', new PluginError(PLUGIN_NAME, err.message));
      }
    }
    
    return callback();
  }

  return through.obj(options, transform, flush);
}

