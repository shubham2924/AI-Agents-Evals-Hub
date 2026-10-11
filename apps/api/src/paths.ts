import { resolve } from 'node:path';

// Works from both apps/api/src (tsx) and apps/api/dist (compiled CommonJS).
export const projectRoot = resolve(__dirname, '../../..');
