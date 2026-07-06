import pino from 'pino';

// Lightweight structured logger (no PII)
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  base: undefined, // Removes pid and hostname
});
