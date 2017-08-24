"use strict";

/*!
 * knox - auth
 * Copyright(c) 2010 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */
 
var crypto = require('crypto')
  , parse = require('url').parse;

var whitelist = [
    'acl'
  , 'delete'
  , 'lifecycle'
  , 'location'
  , 'logging'
  , 'notification'
  , 'partNumber'
  , 'policy'
  , 'requestPayment'
  , 'torrent'
  , 'uploadId'
  , 'uploads'
  , 'versionId'
  , 'versioning'
  , 'versions'
  , 'website'
];

exports.authorization = function(options){
  return 'AWS ' + options.key + ':' + exports.sign(options);
};

exports.hmacSha1 = function(options){
  return crypto.createHmac('sha1', options.secret).update(new Buffer(options.message, 'utf-8')).digest('base64');
};

exports.sign = function(options){
  options.message = exports.stringToSign(options);
  return exports.hmacSha1(options);
};

exports.signQuery = function(options){
  options.message = exports.queryStringToSign(options);
  return exports.hmacSha1(options);
};

exports.stringToSign = function(options){
  var headers = options.amazonHeaders || '';
  if (headers) headers += '\n';
  return [
      options.verb
    , options.md5
    , options.contentType
    , options.date instanceof Date ? options.date.toUTCString() : options.date
    , headers + options.resource
  ].join('\n');
};

exports.queryStringToSign = function(options){
  return (options.verb || 'GET') + '\n\n' +
    (typeof options.contentType !== 'undefined' ?
      options.contentType : '') + '\n' +
    options.date + '\n' +
    (typeof options.extraHeaders !== 'undefined' ?
      exports.canonicalizeHeaders(options.extraHeaders) + '\n' : '') +
    (typeof options.token !== 'undefined' ?
      'x-amz-security-token:' + options.token + '\n' : '') +
    options.resource;
};

exports.canonicalizeHeaders = function(headers){
  var buf = []
    , fields = Object.keys(headers);
  for (var i = 0, len = fields.length; i < len; ++i) {
    var field = fields[i]
      , val = headers[field];

    field = field.toLowerCase();

    if (field.indexOf('x-amz') !== 0 || field === 'x-amz-date') {
      continue;
    }

    buf.push(field + ':' + val);
  }

  var headerSort = function(a, b) {
    // Headers are sorted lexigraphically based on the header name only.
    a = a.split(":")[0]
    b = b.split(":")[0]

    return a > b ? 1 : -1;
  }
  return buf.sort(headerSort).join('\n');
};

exports.canonicalizeResource = function(resource){
  var url = parse(resource, true)
    , path = url.pathname
    , buf = [];

  // apply the query string whitelist
  Object.keys(url.query).forEach(function (key) {
      if (whitelist.indexOf(key) != -1) {
          buf.push(key + (url.query[key] ? "=" + url.query[key] : ''));
      }
  });

  return path + (buf.length
    ? '?' + buf.sort().join('&')
    : '');
};
