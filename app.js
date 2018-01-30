var express = require('express');
var bodyParser = require('body-parser');
var fetch = require('node-fetch');

var app = express();
var exec = require('child_process').execSync;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', function (req, res) {
  console.log('get test');
  res.sendStatus(200);
  res.end();
});

app.get('/site/build/:hash', function (req,res){
  console.log(req.params.hash);

  res.sendStatus(200);
  res.end();
});

app.post('/site/build', function (req, res) {
  if(req.body == undefined || req.body.head_commit == undefined){
    res.sendStatus(400);
    res.end();
  }

  console.log('pulling code from GitHub...');

  // reset any changes that have been made locally
  exec('git -C /home/pi/deploy-site/peiper.se reset --hard', execCallback);

  // and ditch any files that have been added locally too
  exec('git -C /home/pi/deploy-site/peiper.se clean -df', execCallback);

  // now pull down the latest
  exec('git -C /home/pi/deploy-site/peiper.se pull -f', execCallback);

  // respond to github that we have gotten the webhook
  res.sendStatus(200);
  res.end();

  console.log('creating build');
  const url = 'http://localhost:5000/api/deploy/sitebuilds/';
  let data = {hash: req.body.head_commit.id, message: req.body.head_commit.message}
  PostData(data, url)
    .then((res) => {
      if (res.result != null) {
        data = res.result;
        // build
        exec('(cd /home/pi/deploy-site/peiper.se && yarn run build)', function (err, stdout, stderr) { execCallback(err, stdout, stderr, data) });
        console.log('build done');
        //update db
        data.status = 'DONE';
        PostData(data, url)
          .then((res) => {
          });
      }
    });;
});

app.get('/site/deploy', function (req, res) {
  console.log('copying dist to www');
  exec('sudo cp -r peiper.se/dist/. /www/peiper.se');
  console.log('deploy done');

  res.sendStatus(200);
  res.end();
});

app.get('/api/deploy', function (req, res) {

  console.log('pulling code from GitHub...');
  // reset any changes that have been made locally
  exec('sudo git -C /home/pi/peiper-api-publish reset --hard', execCallback);

  // and ditch any files that have been added locally too
  exec('sudo git -C /home/pi/peiper-api-publish clean -df', execCallback);

  // now pull down the latest
  exec('sudo git -C /home/pi/peiper-api-publish pull -f', execCallback);

  // make api executeable
  exec('sudo chmod 755 /home/pi/peiper-api-publish/api');

  // restart service
  exec('sudo systemctl restart kestrel-api.service', execCallback);

  console.log('restarted service');

  res.sendStatus(200);
  res.end();
});

app.listen(3000, function () {
  console.log('listening on port 3000')
});

function execCallback(err, stdout, stderr, data) {
  if (stdout) {
    console.log(stdout);
  }
  if (stderr) {
    if (data) {
      data.status = 'FAILED';
      PostData(data);
    }
    console.log(stderr);
  }
}

function PostData(data, url) {
  const myHeaders = {
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json'
  };
  const options = { method: 'POST', body: JSON.stringify(data), headers: myHeaders, credentials: 'same-origin' };
  return fetch(url, options)
    .then(function (res) {
      return res.json();
    });
}
