var express = require('express');
var bodyParser = require('body-parser');
var exec = require('child_process').execSync;
var cron = require('node-cron');
var cors = require('cors')
var ravenHelper = require('./ravenHelper');

var app = express();
app.use(cors())
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

cron.schedule('0,30 * * * * *', async function () {
  if (await ravenHelper.isBuildInProccess('SiteBuilds')) {
    return;
  }

  let buildInQueue = await ravenHelper.getBuildInQueue('SiteBuilds');
  if (buildInQueue != undefined) {
    await ravenHelper.updateDataStatus(buildInQueue.id, 'STARTED');
    await buildSite(buildInQueue);
  }
});

cron.schedule('15,45 * * * * *', async function () {
  if (await ravenHelper.isBuildInProccess('ApiBuilds')) {
    return;
  }

  let buildInQueue = await ravenHelper.getBuildInQueue('ApiBuilds');
  if (buildInQueue != undefined) {
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
  try {
    exec('(cd /home/pi/build/site/peiper.se && sudo yarn run build)', execCallback);
  } catch (err) {
    console.log('site build failed');
    await ravenHelper.updateDataStatus(data.id, 'FAILED');
    return;
  }

  //copy files to build version folder
  exec('(cd /home/pi/build/site/ && mkdir ' + data.version + ')', execCallback);
  exec('cp -r /home/pi/build/site/peiper.se/dist/. /home/pi/build/site/' + data.version, execCallback);

  //Update build data
  await ravenHelper.updateDataStatus(data.id, 'SUCCESS');
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
  await ravenHelper.updateDataStatus(data.id, 'SUCCESS');
  console.log('api build done: ' + data.hash);
}

//Deploy peiper.se
app.post('/site/deploy', function (req, res) {
  if (req.body == undefined || req.body.version == undefined) {
    console.log('no version specified');
    res.sendStatus(400);
    res.end();
    return;
  }

  console.log('copying dist to www');
  exec('sudo cp -r /home/pi/build/site/' + req.body.version + '/. /www/peiper.se');
  console.log('deploy done');

  res.sendStatus(200);
  res.end();
});

//Deploy peiper api
app.post('/api/deploy', function (req, res) {
  if (req.body == undefined || req.body.version == undefined) {
    console.log('no version specified');
    res.sendStatus(400);
    res.end();
    return;
  }

  console.log('copying publish to /usr/local/peiper-api');
  // stop service
  exec('sudo systemctl stop kestrel-api.service', execCallback);
  exec('sudo cp -r /home/pi/build/api/' + req.body.version + '/. /usr/local/peiper-api');
  // make api executeable
  exec('sudo chmod 755 /usr/local/peiper-api/api');
  // start service
  exec('sudo systemctl start kestrel-api.service', execCallback);

  console.log('deploy done');

  res.sendStatus(200);
  res.end();
});

app.listen(3000, function () {
  console.log('listening on port 3000')
});

function execCallback(err, stdout, stderr) {
  if (stdout) {
    console.log(stdout);
  }
  if (stderr) {
    console.log(stderr);
  }
}

function pullFromGit(repoPath, hash) {
  console.log('checking out code from git with hash: ' + hash);
  // reset any changes that have been made locally
  exec('sudo git -C ' + repoPath + ' reset --hard', execCallback);
  // and ditch any files that have been added locally too
  exec('sudo git -C ' + repoPath + ' clean -df', execCallback);
  //fetch changes to get current working tree
  exec('sudo git -C ' + repoPath + ' fetch', execCallback);
  // now checkout wanted revision
  exec('sudo git -C ' + repoPath + ' checkout ' + hash, execCallback);
  console.log('pulling code from git done');
}
