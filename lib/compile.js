import { Worker } from 'node:worker_threads';
let active = 0;
export const MAX_SOURCE = 128 * 1024;
export function compile(source) {
  if (typeof source !== 'string' || Buffer.byteLength(source) > MAX_SOURCE) return Promise.reject(new Error('source exceeds 128 KiB'));
  if (active >= 2) return Promise.reject(new Error('compiler busy; retry shortly'));
  active++;
  return new Promise((resolve, reject) => {
    let worker;
    try { worker = new Worker(new URL('./compile-worker.cjs', import.meta.url), { workerData: source, resourceLimits: { maxOldGenerationSizeMb: 64 } }); }
    catch(e) { active--; reject(e); return; }
    let done = false;
    const finish = (error, result) => {
      if (done) return; done = true; clearTimeout(timer); active--; worker.terminate();
      if (error) reject(error); else resolve(result);
    };
    const timer = setTimeout(() => finish(new Error('compiler timed out')), 2000);
    worker.once('message', m => finish(m.error ? new Error(m.error) : null, m.result));
    worker.once('error', e => finish(e));
    worker.once('exit', code => { if (!done) finish(new Error(`compiler exited (${code})`)); });
  });
}
