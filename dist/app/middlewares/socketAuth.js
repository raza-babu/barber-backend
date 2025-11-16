"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketAuth = void 0;
const config_1 = __importDefault(require("../../config"));
const verifyToken_1 = require("../utils/verifyToken");
const prisma_1 = __importDefault(require("../utils/prisma"));
const client_1 = require("@prisma/client");
// This middleware validates the socket handshake before allowing connection
const socketAuth = (socket, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const token = ((_a = socket.handshake.auth) === null || _a === void 0 ? void 0 : _a.token) || socket.handshake.query.token;
        // const token = socket.handshake.query.token as string;
        // console.log('Socket token:', token);
        if (!token) {
            return next(new Error('Authentication error: token missing'));
        }
        const decoded = (0, verifyToken_1.verifyToken)(token, config_1.default.jwt.access_secret);
        if (!(decoded === null || decoded === void 0 ? void 0 : decoded.id)) {
            return next(new Error('Authentication error: invalid token payload'));
        }
        const existingUser = yield prisma_1.default.user.findUnique({
            where: { id: decoded.id, status: client_1.UserStatus.ACTIVE },
        });
        if (!existingUser) {
            return next(new Error('Authentication error: user not found or inactive'));
        }
        // Attach user info to socket so you can use it later in events
        socket.user = existingUser;
        return next();
    }
    catch (err) {
        console.error('Socket auth error:', err);
        return next(new Error('Authentication error: invalid or expired token'));
    }
});
exports.socketAuth = socketAuth;
