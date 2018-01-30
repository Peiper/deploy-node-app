var express = require('express');
var bodyParser = require('body-parser');
var exec = require('child_process').execSync;

var ravenHelper = require('./ravenHelper');

var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


app.get('/', function (req, res) {
  console.log('get test');
  res.sendStatus(200);
  res.end();
});

app.post('/site/build', function (req, res) {
  if (req.body == undefined || req.body.head_commit == undefined) {
    res.sendStatus(400);
    res.end();
  }

  pullFromGit('/home/pi/deploy-site/peiper.se');
  createSiteBuild(req.body.head_commit.id, req.body.head_commit.message);

  res.sendStatus(200);
  res.end();
});

async function createSiteBuild(hash, message) {
  console.log('creating build: ' + hash);
  ravenHelper.createSiteBuild(hash, message)
  //Build
  exec('(cd /home/pi/deploy-site/peiper.se && yarn run build)', function (err, stdout, stderr) { execCallback(err, stdout, stderr, data) });

  //TODO mkdir and copy dist

  //Update build data
  await updateData(data.id, 'DONE');
  console.log('build done: ' + hash);
};

app.post('/api/build', function (req, res) {
  if (req.body == undefined || req.body.head_commit == undefined) {
    res.sendStatus(400);
    res.end();
  }

  pullFromGit('/home/pi/peiper-api-publish');
  createApiBuild(req.body.head_commit.id, req.body.head_commit.message);

  res.sendStatus(200);
  res.end();
});

async function createApiBuild(hash, message) {
  console.log('creating build');

  ravenHelper.createApiBuild(hash, message);

  //Build
  //TODO wait for dotnet publish to work
  //exec('(cd /home/pi/deploy-site/peiper.se && yarn run build)', function (err, stdout, stderr) { execCallback(err, stdout, stderr, data) });

  //TODO mkdir copy files

  //Update build data
  await updateData(data.id, 'DONE');
  console.log('build done');
}

//Deploy peiper.se
app.get('/site/deploy', function (req, res) {

  //TODO mkdir release version

  console.log('copying dist to www');
  //TODO check path
  exec('sudo cp -r /home/pi/site-deploy/peiper.se/dist/. /www/peiper.se');
  console.log('deploy done');

  res.sendStatus(200);
  res.end();
});

//Deploy peiper api
app.get('/api/deploy', function (req, res) {

  //TODO mkdir release version

  console.log('copying publish to /usr/local/peiper-api');
  exec('sudo cp -r /home/pi/peiper-api-publish/. /usr/local/peiper-api');
  // make api executeable
  exec('sudo chmod 755 /usr/local/peiper-api/api');
  // restart service
  exec('sudo systemctl restart kestrel-api.service', execCallback);

  console.log('deploy done');

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
      ravenHelper.updateData(data.id, 'FAILED');
    }
    console.log(stderr);
  }
}

function pullFromGit(repoPath) {
  console.log('pulling code from GitHub...');
  // reset any changes that have been made locally
  exec('sudo git -C ' + repoPath + ' --hard', execCallback);
  // and ditch any files that have been added locally too
  exec('sudo git -C ' + repoPath + ' clean -df', execCallback);
  // now pull down the latest
  exec('sudo git -C ' + repoPath + 'pull -f', execCallback);
  console.log('pulling code from done');
}
