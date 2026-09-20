export function createLogger(config = {}) {
  const minLevel = config.logLevel ?? 'info';
  const levelRank = { debug: 10, info: 20, warn: 30, error: 40 };

  function shouldLog(level) {
    return (levelRank[level] ?? 20) >= (levelRank[minLevel] ?? 20);
  }

  function write(level, message, context = {}) {
    if (!shouldLog(level)) {
      return;
    }

    const payload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    };

    const serialized = JSON.stringify(payload);
    if (level === 'error') {
      console.error(serialized);
      return;
    }
    if (level === 'warn') {
      console.warn(serialized);
      return;
    }
    console.log(serialized);
  }

  return {
    debug(message, context) {
      write('debug', message, context);
    },
    info(message, context) {
      write('info', message, context);
    },
    warn(message, context) {
      write('warn', message, context);
    },
    error(message, context) {
      write('error', message, context);
    },
  };
}
