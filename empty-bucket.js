'use strict';

const AWS = require('aws-sdk');
const assign = require('lodash.assign');

const plugin = aws => {
  const client = new AWS.S3({
    apiVersion: '2006-03-01',
    accessKeyId: aws.key,
    secretAccessKey: aws.secret,
    region: aws.region
  });

  const emptyBucket = params => {
    client.listObjectsV2(params, (err, data) => {
      if (err) {
        return console.log(err, err.stack);
      }

      const keys = data.Contents.map(item => ({Key: item.Key}));
      const deletionParams = assign({Bucket: params.Bucket}, {Delete: {Objects: keys}});

      client.deleteObjects(deletionParams, deletionErr => {
        if (deletionErr) {
          return console.log(deletionErr, deletionErr.stack);
        }

        if (data.NextContinuationToken) {
          const nextParams = assign({}, params, {ContinuationToken: data.NextContinuationToken});
          emptyBucket(nextParams);
        }
      });
    });
  };

  emptyBucket({Bucket: aws.bucket});
};

module.exports = plugin;
