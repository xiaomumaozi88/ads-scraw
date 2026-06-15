import { pushMemoryLog } from './memoryLogAppender.js';

function formatArgs(args) {
  return args
    .map((a) => {
      if (a instanceof Error) return a.stack || a.message;
      if (typeof a === 'object' && a !== null) {
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      }
      return String(a);
    })
    .join(' ');
}

export const logger = {
  info(...args) {
    console.log(...args);
    pushMemoryLog('INFO', formatArgs(args));
  },
  warn(...args) {
    console.warn(...args);
    pushMemoryLog('WARN', formatArgs(args));
  },
  error(...args) {
    console.error(...args);
    pushMemoryLog('ERROR', formatArgs(args));
  },
};

globalThis.logger = logger;
