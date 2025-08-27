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
exports.setupSocketIO = void 0;
const verifyToken_1 = require("./verifyToken");
const socket_io_1 = require("socket.io");
const config_1 = __importDefault(require("../../config"));
const prisma_1 = __importDefault(require("./prisma"));
const client_1 = require("@prisma/client");
const onlineUsers = new Set();
const userSockets = new Map();
function setupSocketIO(server) {
    // const io = new SocketIOServer(server);
    const io = new socket_io_1.Server(server, {
        cors: {
            origin: '*',
        },
    });
    const messagesNameSpace = io.of('/messages');
    messagesNameSpace.on('connection', (socket) => __awaiter(this, void 0, void 0, function* () {
        console.log('A user connected to messages namespace');
        const token = socket.handshake.query.token;
        if (!token) {
            console.log('No token provided');
            socket.disconnect();
            return;
        }
        const user = (0, verifyToken_1.verifyToken)(token, config_1.default.jwt.access_secret);
        const { id, role } = user;
        const existingUser = yield prisma_1.default.user.findUnique({
            where: { id: id, status: client_1.UserStatus.ACTIVE },
        });
        if (!existingUser) {
            console.log('User not found or inactive');
            socket.disconnect();
            return;
        }
        // Add user to online users set
        onlineUsers.add(id);
        userSockets.set(id, socket);
        // Notify all users about the new user's online status
        messagesNameSpace.emit('userStatus', { userId: id, isOnline: true });
        // Broadcast the updated list of online users
        messagesNameSpace.emit('onlineUsers', Array.from(onlineUsers));
        socket.on('disconnect', () => {
            console.log('User disconnected from messages namespace');
            // Remove user from online users set
            onlineUsers.delete(id);
            userSockets.delete(id);
            // Notify all users about the user's offline status
            messagesNameSpace.emit('userStatus', { userId: id, isOnline: false });
            // Broadcast the updated list of online users
            messagesNameSpace.emit('onlineUsers', Array.from(onlineUsers));
        });
        userSockets.set(id, socket);
        socket.on('message', (payload) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!payload.receiverId || !payload.message) {
                    console.log('Receiver ID or message is undefined');
                    return;
                }
                // Fetch receiver's role
                const receiver = yield prisma_1.default.user.findUnique({
                    where: { id: payload.receiverId },
                    select: { role: true },
                });
                if (!receiver) {
                    console.log('Receiver not found');
                    return;
                }
                // Enforce customer-initiated chat with saloon owner
                if (role === client_1.UserRoleEnum.SALOON_OWNER &&
                    receiver.role === client_1.UserRoleEnum.CUSTOMER) {
                    // Check if a room already exists
                    const existingRoom = yield prisma_1.default.room.findFirst({
                        where: {
                            OR: [
                                { senderId: id, receiverId: payload.receiverId },
                                { senderId: payload.receiverId, receiverId: id },
                            ],
                        },
                    });
                    if (!existingRoom) {
                        // Saloon owner cannot start chat with customer
                        socket.emit('error', 'You cannot start a chat with a customer.');
                        return;
                    }
                }
                const room = yield prisma_1.default.room.findFirst({
                    where: {
                        OR: [
                            { senderId: id, receiverId: payload.receiverId },
                            { senderId: payload.receiverId, receiverId: id },
                        ],
                    },
                });
                let roomId;
                if (!room) {
                    const newRoom = yield prisma_1.default.room.create({
                        data: {
                            senderId: id,
                            receiverId: payload.receiverId,
                        },
                    });
                    if (!newRoom) {
                        console.log('Error saving room');
                        return;
                    }
                    roomId = newRoom.id;
                }
                else {
                    roomId = room.id;
                }
                // if (
                //   payload.images &&
                //   (!Array.isArray(payload.images) || payload.images.length === 0)
                // ) {
                //   console.log('Images array is null');
                // }
                const chat = yield prisma_1.default.chat.create({
                    data: {
                        senderId: id,
                        receiverId: payload.receiverId,
                        roomId: roomId,
                        message: payload.message,
                        // images: { set: payload.images }, // Ensure images are saved as an array
                    },
                });
                if (!chat) {
                    console.log('Error saving chat');
                    return;
                }
                const roomName = [id, payload.receiverId].sort().join('-');
                // Sender joins the room
                socket.join(roomName);
                // Receiver joins the room if online
                const receiverSocket = userSockets.get(payload.receiverId);
                if (receiverSocket) {
                    receiverSocket.join(roomName);
                }
                // Emit the message to the room
                messagesNameSpace.to(roomName).emit('message', chat);
            }
            catch (error) {
                console.error('Error handling message event:', error);
            }
        }));
        socket.on('fetchChats', (payload) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!payload || !payload.receiverId) {
                    console.log('Receiver ID is undefined');
                    return;
                }
                const room = yield prisma_1.default.room.findFirst({
                    where: {
                        OR: [
                            { senderId: id, receiverId: payload.receiverId },
                            { senderId: payload.receiverId, receiverId: id },
                        ],
                    },
                });
                if (!room) {
                    console.log('Room not found');
                    socket.emit('noRoomFound', 'No room found');
                    return;
                }
                const chats = yield prisma_1.default.chat.findMany({
                    where: {
                        roomId: room.id,
                    },
                    orderBy: {
                        createdAt: 'asc',
                    },
                });
                if (chats) {
                    yield prisma_1.default.chat.updateMany({
                        where: {
                            roomId: room.id,
                        },
                        data: {
                            isRead: true,
                        },
                    });
                }
                socket.emit('chats', chats);
                // Ensure both users join the room
                const roomName = [id, payload.receiverId].sort().join('-');
                socket.join(roomName);
                const receiverSocket = userSockets.get(payload.receiverId);
                if (receiverSocket) {
                    receiverSocket.join(roomName);
                }
            }
            catch (error) {
                console.error('Error fetching chats:', error);
            }
        }));
        socket.on('unReadMessages', (payload) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!payload || !payload.receiverId) {
                    console.log('Receiver ID is undefined');
                    return;
                }
                const room = yield prisma_1.default.room.findFirst({
                    where: {
                        OR: [
                            { senderId: id, receiverId: payload.receiverId },
                            { senderId: payload.receiverId, receiverId: id },
                        ],
                    },
                });
                if (!room) {
                    console.log('Room not found');
                    return;
                }
                const chats = yield prisma_1.default.chat.findMany({
                    where: {
                        roomId: room.id,
                        isRead: false,
                        receiverId: id,
                    },
                });
                const unReadMessagesCount = yield prisma_1.default.chat.count({
                    where: {
                        roomId: room.id,
                        isRead: false,
                        receiverId: id,
                    },
                });
                if (unReadMessagesCount === 0) {
                    socket.emit('noUnreadMessages', 'No unread messages left');
                    return;
                }
                socket.emit('unReadMessages', chats, unReadMessagesCount);
            }
            catch (error) {
                console.error('Error fetching unReadMessages:', error);
            }
        }));
        socket.on('messageList', () => __awaiter(this, void 0, void 0, function* () {
            try {
                // Only fetch rooms where the user is sender or receiver
                const rooms = yield prisma_1.default.room.findMany({
                    where: {
                        OR: [{ senderId: id }, { receiverId: id }],
                    },
                    include: {
                        chat: {
                            orderBy: {
                                createdAt: 'desc',
                            },
                            take: 1,
                        },
                    },
                });
                // Collect all unique user IDs involved in these rooms
                const userIds = Array.from(new Set(rooms
                    .map(room => [room.senderId, room.receiverId])
                    .flat()
                    .filter((uid) => !!uid)));
                // Fetch user info for all involved users
                const userInfos = yield prisma_1.default.user.findMany({
                    where: {
                        id: {
                            in: userIds,
                        },
                    },
                    select: {
                        id: true,
                        fullName: true,
                        image: true,
                    },
                });
                const roomsWithUnreadMessages = yield Promise.all(rooms.map((room) => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b, _c, _d;
                    const unReadMessagesCount = yield prisma_1.default.chat.count({
                        where: {
                            roomId: room.id,
                            isRead: false,
                            receiverId: id,
                        },
                    });
                    return {
                        chat: room.chat[0], // Include only the latest chat
                        // sender: userInfos.find(userInfo => userInfo.id === room.senderId),
                        // receiver: userInfos.find(userInfo => userInfo.id === room.receiverId),
                        unReadMessagesCount,
                        senderName: ((_a = userInfos.find(userInfo => userInfo.id === room.receiverId)) === null || _a === void 0 ? void 0 : _a.fullName) || null,
                        senderImage: ((_b = userInfos.find(userInfo => userInfo.id === room.receiverId)) === null || _b === void 0 ? void 0 : _b.image) || null,
                        receiverName: ((_c = userInfos.find(userInfo => userInfo.id === room.senderId)) === null || _c === void 0 ? void 0 : _c.fullName) || null,
                        receiverImage: ((_d = userInfos.find(userInfo => userInfo.id === room.senderId)) === null || _d === void 0 ? void 0 : _d.image) || null,
                    };
                })));
                socket.emit('messageList', roomsWithUnreadMessages.length ? roomsWithUnreadMessages : []);
            }
            catch (error) {
                console.error('Error fetching messageList:', error);
            }
        }));
    }));
    return io;
}
exports.setupSocketIO = setupSocketIO;
