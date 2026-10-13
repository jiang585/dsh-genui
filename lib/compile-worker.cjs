const { parentPort, workerData } = require('node:worker_threads');
try { parentPort.postMessage({ result: require('../vendor/compiler/index.js').compile(workerData) }); }
catch (e) { parentPort.postMessage({ error: e.message }); }
