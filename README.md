## Instantiation

```javascript
var s3Client = require('adams3client');

var client = s3Client.createClient({
  key: "<key>",
  secret: "<secret>",
  bucket:"<bucket-name>",
  region:"<region>"
});
```

## Putting a file

```javascript
client.putFile('/location/of/your/file.txt', '/location/on/s3/filename.json', function(err, res){
  //Please be sure to check the status
  if (200 == res.statusCode) {
    console.log('saved to %s', req.url);
  }
  res.resume();
});
```
