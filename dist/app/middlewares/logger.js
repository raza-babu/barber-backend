"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggerConsole = exports.logger = void 0;
const morgan_1 = __importDefault(require("morgan"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Ensure logs directory exists
const logDir = path_1.default.join(__dirname, '../logs');
if (!fs_1.default.existsSync(logDir)) {
    fs_1.default.mkdirSync(logDir);
}
// Custom format with a clear prefix
const customFormat = '\n[API REQUEST] :date[iso]\nMethod: :method\nURL: :url\nStatus: :status\nResponse Time: :response-time ms\n-----------------------------';
const logStream = fs_1.default.createWriteStream(path_1.default.join(logDir, 'access.log'), { flags: 'a' });
// Log to file with custom format
const logger = (0, morgan_1.default)('combined');
exports.logger = logger;
// Log to console with custom format
const loggerConsole = (0, morgan_1.default)(customFormat);
exports.loggerConsole = loggerConsole;
