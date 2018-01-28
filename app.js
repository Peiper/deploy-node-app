var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var exec = require('child_process').execSync;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', function (req, res) {
  console.log('get test');
  res.sendStatus(200);
  res.end();
});

app.post('/build', function (req, res) {

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

  console.log('running build');
  // build
  exec('(cd peiper.se && yarn run build)', execCallback);

  console.log('build done');
});

app.get('/deploy-site', function (req, res) {
  console.log('copying dist to www');
  exec('sudo cp -r peiper.se/dist/. /www/peiper.se');
  console.log('deploy done');

  res.sendStatus(200);
  res.end();
});

app.get('/deploy-api', function (req, res) {

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

function execCallback(err, stdout, stderr) {
  if (stdout) console.log(stdout);
  if (stderr) console.log(stderr);
}
