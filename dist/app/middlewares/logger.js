"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggerConsole = exports.logger = void 0;
const morgan_1 = __importDefault(require("morgan"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Use /tmp which is writable in Vercel
const logDir = path_1.default.join('/tmp', 'logs'); // <-- /tmp/logs
if (!fs_1.default.existsSync(logDir)) {
    fs_1.default.mkdirSync(logDir, { recursive: true });
}
// Custom format with a clear prefix
const customFormat = '\n[API REQUEST] :date[iso]\nMethod: :method\nURL: :url\nStatus: :status\nResponse Time: :response-time ms\n-----------------------------';
// Log to file in /tmp
const logStream = fs_1.default.createWriteStream(path_1.default.join(logDir, 'access.log'), { flags: 'a' });
// Morgan instances
const logger = (0, morgan_1.default)('combined', { stream: logStream });
exports.logger = logger;
const loggerConsole = (0, morgan_1.default)(customFormat);
exports.loggerConsole = loggerConsole;
