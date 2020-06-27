import * as through from 'through2';
import { TransformFunction, FlushCallback } from 'through2';
import * as PluginError from 'plugin-error';
import { red } from 'ansi-colors';
import * as log from 'fancy-log';
import { S3 } from 'aws-sdk'
import { chunk } from 'lodash';

const PLUGIN_NAME = 'gulp-s3-publish/clean';

export interface CleanOpts {
  bucket: string;
  uploadPath?: string;
  whitelist?: CleanWhitelistEntry[];
  dryRun?: boolean;
}

export interface CleanWhitelistEntry {
  type: 'key' | 'keyPrefix';
  path: string;
}

const defaults: Partial<CleanOpts> = {
  uploadPath: '',
  whitelist: [],
  dryRun: false,
};

export function clean(client: S3, userOptions: CleanOpts) {
  const options: CleanOpts = Object.assign({}, defaults, userOptions);

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
    const listParams: S3.ListObjectsRequest = { 
      Bucket: options.bucket,
      Prefix: options.uploadPath
    };
    let response = await client.listObjects(listParams).promise();
    objects = objects.concat(response.Contents)

    while(response.IsTruncated) {
      listParams.Marker = response.NextMarker;
      response = await client.listObjects(listParams).promise();
      objects = objects.concat(response.Contents);
    }

    const whitelistKeyPrefixes = options.whitelist.filter(w => w.type === 'keyPrefix'); 
    const whitelistKeys = options.whitelist.filter(w => w.type === 'key'); 

    // Delete old files
    const objectsToDelete = objects
      .filter(object => !files.find(f => f === object.Key))
      .filter(object => !whitelistKeys.find(w => `${options.uploadPath}/${w.path}` === object.Key))
      .filter(object => !whitelistKeyPrefixes.find(w => object.Key.startsWith(`${options.uploadPath}/${w.path}`)));

    if (options.dryRun) {
      log('Files to be deleted: ');
      for(const object of objectsToDelete) {
        log(red(object.Key));
      }
      // Return early
      return callback();
    }

    for(const objects of chunk(objectsToDelete, 1000)) {
      const keys = objects.map(object => ({ Key: object.Key }));
      const deleteParams: S3.DeleteObjectsRequest = {
        Delete: {
          Objects: keys
        },
        Bucket: options.bucket,
      }

      try {
        await client.deleteObjects(deleteParams).promise();
      } catch (err) {
        this.emit('error', new PluginError(PLUGIN_NAME, err.message));
      }
    }
    
    return callback();
  }

  return through.obj(transform, flush);
}

