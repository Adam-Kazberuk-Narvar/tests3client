/*!
 * knox - Client
 * Copyright(c) 2010 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

var fs = require('fs')
  , utils = require('./utils')
  , https = require('https')
  , auth = require('./auth')
  , mime = require('mime')
  , once = require('once')


var AssistS3Client = module.exports = exports = function AssistS3Client(options) {
  if (!options.key) throw new Error('aws key required');
  if (!options.secret) throw new Error('aws secret required');
  if (!options.bucket) throw new Error('aws bucket required');
  options.style = 'virtualHosted'; //confirm?

  options = getEndPoint(options);

  // Save original options, we will need them for Client#copyTo
  this.options = utils.merge({}, options);

  // Make sure we don't override options the user passes in.
  options = utils.merge({}, options);

  var portSuffix = 'undefined' == typeof options.port ? "" : ":" + options.port;

  this.host = options.bucket + '.' + options.endpoint;
  this.urlBase = options.bucket + '.' + options.endpoint + portSuffix;

  this.agent = false;

  utils.merge(this, options);

  this.url = this.https;
};

AssistS3Client.prototype.request = function(method, filename, headers){
  var options = { hostname: this.host, agent: this.agent, port: this.port }
    , date = new Date
    , headers = headers || {}
    , fixedFilename = ensureLeadingSlash(filename);

  headers.Host = this.host;
  // Default headers
  headers.Date = date.toUTCString()

  if ('undefined' != typeof this.token)
    headers['x-amz-security-token'] = this.token;

  // Authorization header
  headers.Authorization = auth.authorization({
      key: this.key
    , secret: this.secret
    , verb: method
    , date: date
    , resource: auth.canonicalizeResource('/' + this.bucket + fixedFilename)
    , contentType: getHeader(headers, 'content-type')
    , md5: getHeader(headers, 'content-md5') || ''
    , amazonHeaders: auth.canonicalizeHeaders(headers)
  });

  var pathPrefix = '';

  // Issue request
  options.method = method;
  options.path = pathPrefix + fixedFilename;
  options.headers = headers;
  var req = https.request(options);
  req.url = this.url(filename);
  return req;
};

AssistS3Client.prototype.put = function(filename, headers){
  headers = utils.merge({}, headers || {});
  return this.request('PUT', encodeSpecialCharacters(filename), headers);
};

AssistS3Client.prototype.putFile = function(src, filename, headers, fn){
  var self = this;

  if ('function' == typeof headers) {
    fn = headers;
    headers = {};
  }

  console.log('put %s', src);
  fs.stat(src, function (err, stat) {
    if (err) return fn(err);

    var contentType = mime.lookup(src);

    // Add charset if it's known.
    var charset = mime.charsets.lookup(contentType);
    if (charset) {
      contentType += '; charset=' + charset;
    }

    headers = utils.merge({
        'Content-Length': stat.size
      , 'Content-Type': contentType
    }, headers);

    var stream = fs.createReadStream(src);

    var req = self.putStream(stream, filename, headers, fn);

  });
};


function getHeader(headers, headerNameLowerCase) {
  for (var header in headers) {
    if (header.toLowerCase() === headerNameLowerCase) {
      return headers[header];
    }
  }
  return null;
}

AssistS3Client.prototype.https = function(filename){
  filename = encodeSpecialCharacters(ensureLeadingSlash(filename));
  return 'https://' + this.urlBase + filename;
};

AssistS3Client.prototype.putStream = function(stream, filename, headers, fn){
  var contentLength = getHeader(headers, 'content-length');
  if (contentLength === null) {
    process.nextTick(function () {
      fn(new Error('You must specify a Content-Length header.'));
    });
    return;
  }

  var self = this;
  var req = self.put(filename, headers);

  fn = once(fn);
  registerReqListeners(req, fn);
  stream.on('error', fn);

  stream.pipe(req);
  return req;
};

function getEndPoint(options){
  if (!options.endpoint) {
    if (!options.region || options.region === 'us-standard' || options.region === 'us-east-1') {
      options.endpoint = 's3.amazonaws.com';
      options.region = 'us-standard';
    } else {
      options.endpoint = 's3-' + options.region + '.amazonaws.com';
    }
  } else {
    options.region = undefined;
  }
  return options;
};

function registerReqListeners(req, fn){
  req.on('response', function (res) {
    fn(null, res);
  });
  req.on('error', fn);
};

function encodeSpecialCharacters(filename) {
  // Note: these characters are valid in URIs, but S3 does not like them for
  // some reason.
  return encodeURI(filename).replace(/[!'()#*+? ]/g, function (char) {
    return '%' + char.charCodeAt(0).toString(16);
  });
};

function ensureLeadingSlash(filename) {
  return filename[0] !== '/' ? '/' + filename : filename;
}

exports.createClient = function(options){
  return new AssistS3Client(options);
}
