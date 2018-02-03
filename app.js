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
    console.log('no commit data from git');
    res.sendStatus(400);
    res.end();
    return;
  }

  pullFromGit('/home/pi/build/site/peiper.se');
  res.sendStatus(200);
  res.end();

  createSiteBuild(req.body.head_commit.id, req.body.head_commit.message);
});

async function createSiteBuild(hash, message) {
  console.log('creating build: ' + hash);
  let data = await ravenHelper.createSiteBuild(hash, message);
  //Build
  exec('(cd /home/pi/build/site/peiper.se && yarn run build)', function (err, stdout, stderr) { execCallback(err, stdout, stderr, data) });

  //copy files to build version folder
  exec('(cd /home/pi/build/site/ && mkdir ' + data.version + ')', execCallback);
  exec('cp -r /home/pi/build/site/peiper.se/dist/. /home/pi/build/site/' + data.version, execCallback);

  //Update build data
  await ravenHelper.updateData(data.id, 'DONE');
  console.log('build done: ' + hash);
};

app.post('/api/build', function (req, res) {
  if (req.body == undefined || req.body.head_commit == undefined) {
    console.log('no commit data from git');
    res.sendStatus(400);
    res.end();
    return;
  }

  pullFromGit('/home/pi/build/api/peiper-api-publish');
  res.sendStatus(200);
  res.end();

  createApiBuild(req.body.head_commit.id, req.body.head_commit.message);
});

async function createApiBuild(hash, message) {
  console.log('creating build');

  let data = await ravenHelper.createApiBuild(hash, message);

  //Build
  //TODO wait for dotnet publish to work

  //copy files to build version folder
  exec('(cd /home/pi/build/api/ && mkdir ' + data.version + ')', execCallback);
  exec('cp -r /home/pi/build/api/peiper-api-publish/. /home/pi/build/api/' + data.version, execCallback);

  //Update build data
  await ravenHelper.updateData(data.id, 'DONE');
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
  console.log('pulling code from git');
  // reset any changes that have been made locally
  exec('sudo git -C ' + repoPath + ' reset --hard', execCallback);
  // and ditch any files that have been added locally too
  exec('sudo git -C ' + repoPath + ' clean -df', execCallback);
  // now pull down the latest
  exec('sudo git -C ' + repoPath + ' pull -f', execCallback);
  console.log('pulling code from git done');
}
