// polyfill.ts
import crossFetch from 'cross-fetch';

if (!globalThis.fetch) {
  globalThis.fetch = crossFetch;
}

console.log("Polyfill: global fetch defined:", !!globalThis.fetch);
