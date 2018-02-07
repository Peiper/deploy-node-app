var express = require('express');
var bodyParser = require('body-parser');
var exec = require('child_process').execSync;
var cron = require('node-cron');

var ravenHelper = require('./ravenHelper');

var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

cron.schedule('0,30 * * * * *', async function () {
  console.log('checking for queued site builds');
  if (await ravenHelper.isBuildInProccess('SiteBuilds')) {
    console.log('site build is in progess');
    return;
  }
  console.log('no site build in progress');
  let buildInQueue = await ravenHelper.getBuildInQueue('SiteBuilds');
  if (buildInQueue != undefined) {
    console.log('site builds in queue');
    await ravenHelper.updateDataStatus(buildInQueue.id, 'STARTED');
    await buildSite(buildInQueue);
  }
});

cron.schedule('15,45 * * * * *', async function () {
  console.log('checking for queued api builds');
  if (await ravenHelper.isBuildInProccess('ApiBuilds')) {
    console.log('api build is in progess');
    return;
  }
  console.log('no api build in progress');
  let buildInQueue = await ravenHelper.getBuildInQueue('ApiBuilds');
  if (buildInQueue != undefined) {
    console.log('api builds in queue');
    await ravenHelper.updateDataStatus(buildInQueue.id, 'STARTED');
    await buildApi(buildInQueue);
  }
});

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

  queueSiteBuild(req.body.head_commit.id, req.body.head_commit.message);
  res.sendStatus(200);
  res.end();
});

async function queueSiteBuild(hash, message) {
  console.log('creating build: ' + hash);
  ravenHelper.createSiteBuild(hash, message);
};

async function buildSite(data) {
  console.log('starting build: ' + data.hash);
  pullFromGit('/home/pi/build/site/peiper.se', data.hash);
  //Build
  exec('(cd /home/pi/build/site/peiper.se && yarn run build)', function (err, stdout, stderr) { execCallback(err, stdout, stderr, data) });

  //copy files to build version folder
  exec('(cd /home/pi/build/site/ && mkdir ' + data.version + ')', execCallback);
  exec('cp -r /home/pi/build/site/peiper.se/dist/. /home/pi/build/site/' + data.version, execCallback);

  //Update build data
  await ravenHelper.updateDataStatus(data.id, 'DONE');
  console.log('build done: ' + data.hash);
}

app.post('/api/build', function (req, res) {
  if (req.body == undefined || req.body.head_commit == undefined) {
    console.log('no commit data from git');
    res.sendStatus(400);
    res.end();
    return;
  }

  queueApiBuild(req.body.head_commit.id, req.body.head_commit.message);
  res.sendStatus(200);
  res.end();
});

async function queueApiBuild(hash, message) {
  console.log('creating api build: ' + hash);
  ravenHelper.createApiBuild(hash, message);
}

async function buildApi(data) {
  console.log('starting api build: ' + data.hash);
  pullFromGit('/home/pi/build/api/peiper-api-publish', data.hash);
  //Build
  //TODO wait for dotnet publish to work

  //copy files to build version folder
  exec('(cd /home/pi/build/api/ && mkdir ' + data.version + ')', execCallback);
  exec('cp -r /home/pi/build/api/peiper-api-publish/. /home/pi/build/api/' + data.version, execCallback);

  //Update build data
  await ravenHelper.updateDataStatus(data.id, 'DONE');
  console.log('api build done: ' + data.hash);
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
      ravenHelper.updateDataStatus(data.id, 'FAILED');
    }
    console.log(stderr);
  }
}

function pullFromGit(repoPath, hash) {
  console.log('checking out code from git with hash: ' + hash);
  // reset any changes that have been made locally
  exec('sudo git -C ' + repoPath + ' reset --hard', execCallback);
  // and ditch any files that have been added locally too
  exec('sudo git -C ' + repoPath + ' clean -df', execCallback);
  // now checkout wanted revision
  exec('sudo git -C ' + repoPath + ' checkout ' + hash, execCallback);
  console.log('pulling code from git done');
}
