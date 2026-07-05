import { appendFileSync } from 'fs';
import { join } from 'path';

const DEBUG_LOG = join(process.cwd(), 'debug-138d33.log');

export function writeDebugLog(payload: Record<string, unknown>) {
  try {
    appendFileSync(DEBUG_LOG, `${JSON.stringify({ ...payload, timestamp: Date.now() })}\n`);
  } catch {
    /* ignore write failures in prod */
  }
}
