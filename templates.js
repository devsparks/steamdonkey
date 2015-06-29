
var fs = require('fs');
var path = require('path');
var yaml = require('js-yaml');
var chokidar = require('chokidar');
var child_process = require('child_process');

const CONFIG_FILE = './data/config.yml';
const UTF8 = 'utf-8'
const CREATE = 'add';
const UPDATE = 'change';
const DELETE = 'unlink';

require("babel/register")({
  only: /steamdonkey/,
  extensions: [".es6"]
});

var TemplatePreprocessor = require('./steamdonkey_modules/template-preprocessor.es6');

try {
  var args = process.argv;
  var config = yaml.safeLoad(fs.readFileSync(CONFIG_FILE, UTF8));
  var dev = config.environments.dev;
  
  var debugMode = false;
  var watchFiles = false;
  var syncAssets = false;
  
  for (var i = 0; i < args.length; i++) {
    if (args[i] === '--debug') {
      debugMode = true;
    } else if (args[i] === '--watch') {
      watchFiles = true;
    } else if (args[i] === '--sync') {
      syncAssets = true;
    }
  }

  var tplPreProc = new TemplatePreprocessor(dev.folders, dev.layout, debugMode);
  tplPreProc.processTemplates();
  
  if (watchFiles) {
    var baseDir = dev.folders.layout.src;
    var watcher = chokidar.watch(baseDir, {persistent: true, ignoreInitial: true});
    
    // 1. watch .scss => compass compile
    // var msg = child_process.execSync('compass compile', { encoding: 'utf8' });
    // process.stdout.write(msg);

    //2. if syncAssets => sync assets
    
    watcher
      .on(CREATE, function(filePath) { tplPreProc.updateTemplates(filePath, CREATE); })
      .on(UPDATE, function(filePath) { tplPreProc.updateTemplates(filePath, UPDATE); })
      .on(DELETE, function(filePath) { tplPreProc.updateTemplates(filePath, DELETE); });
    console.log('Watcher started on folder "%s"', path.resolve(baseDir));
  }
} catch (e) {
  console.log(e);
}
