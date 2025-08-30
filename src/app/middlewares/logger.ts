import morgan from 'morgan';
import fs from 'fs';
import path from 'path';

// Ensure logs directory exists
const logDir = path.join(__dirname, '../tmp/logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom format with a clear prefix
const customFormat =
  '\n[API REQUEST] :date[iso]\nMethod: :method\nURL: :url\nStatus: :status\nResponse Time: :response-time ms\n-----------------------------';

const logStream = fs.createWriteStream(
  path.join(logDir, 'access.log'),
  { flags: 'a' }
);

// Log to file with custom format
const logger = morgan("combined", { stream: logStream });

// Log to console with custom format
const loggerConsole = morgan(customFormat);

export { logger, loggerConsole };