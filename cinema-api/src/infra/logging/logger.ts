import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'cinema-api' },
  transports: [new winston.transports.Console()],
});

export function getLogger(context?: string) {
  if (context) {
    return logger.child({ context });
  }
  return logger;
}

export default logger;
