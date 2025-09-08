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
const socket_io_1 = require("socket.io");
const prisma_1 = __importDefault(require("./prisma"));
const socketAuth_1 = require("../middlewares/socketAuth");
const client_1 = require("@prisma/client");
const onlineUsers = new Set();
const userSockets = new Map();
function setupSocketIO(server) {
    const io = new socket_io_1.Server(server, {
        cors: {
            origin: '*',
        },
    });
    const messagesNameSpace = io.of('/messages');
    // Apply auth middleware to namespace
    messagesNameSpace.use(socketAuth_1.socketAuth);
    messagesNameSpace.on('connection', (socket) => __awaiter(this, void 0, void 0, function* () {
        console.log('✅ User connected to messages namespace');
        const user = socket.user; // comes from socketAuth
        const { id } = user;
        // Add user to online users set
        onlineUsers.add(id);
        userSockets.set(id, socket);
        // Notify all users about the new user's online status
        messagesNameSpace.emit('userStatus', { userId: id, isOnline: true });
        messagesNameSpace.emit('onlineUsers', Array.from(onlineUsers));
        socket.on('disconnect', () => {
            console.log('❌ User disconnected from messages namespace');
            onlineUsers.delete(id);
            userSockets.delete(id);
            messagesNameSpace.emit('userStatus', { userId: id, isOnline: false });
            messagesNameSpace.emit('onlineUsers', Array.from(onlineUsers));
        });
        // userSockets.set(id, socket);
        socket.on('message', (payload) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!payload.receiverId || !payload.message) {
                    console.log('Receiver ID or message is undefined');
                    return;
                }
                // Check subscription plan from user token (assumed to be set by socketAuth)
                const subscriptionPlan = user.subscriptionPlan; // e.g., 'free', 'premium', etc.
                const senderRole = user.role; // e.g., 'saloonOwner', 'barber', etc.
                // Fetch receiver's role
                const receiver = yield prisma_1.default.user.findUnique({
                    where: { id: payload.receiverId },
                    select: { role: true },
                });
                if (!receiver) {
                    console.log('Receiver not found');
                    return;
                }
                const receiverRole = receiver.role;
                // If subscription is free, prevent chat between saloon owner and barber or the customer
                if (subscriptionPlan === client_1.SubscriptionPlanStatus.FREE &&
                    ((senderRole === client_1.UserRoleEnum.SALOON_OWNER &&
                        receiverRole === client_1.UserRoleEnum.BARBER) ||
                        (senderRole === client_1.UserRoleEnum.SALOON_OWNER &&
                            receiverRole === client_1.UserRoleEnum.CUSTOMER))) {
                    socket.emit('error', {
                        message: 'Chat between saloon owner and barber or customer is not allowed on free plan.',
                    });
                    return;
                }
                // BASIC_PREMIUM: can only chat with barbers, not customers
                if (subscriptionPlan === client_1.SubscriptionPlanStatus.BASIC_PREMIUM &&
                    receiverRole !== client_1.UserRoleEnum.BARBER) {
                    socket.emit('error', {
                        message: `With BASIC_PREMIUM, you can only chat with barbers.`,
                    });
                    return;
                }
                // ADVANCED_PREMIUM: can only chat with customers, not barbers
                if (subscriptionPlan === client_1.SubscriptionPlanStatus.ADVANCED_PREMIUM &&
                    receiverRole !== client_1.UserRoleEnum.CUSTOMER) {
                    socket.emit('error', {
                        message: `With ADVANCED_PREMIUM, you can only chat with customers.`,
                    });
                    return;
                }
                // senderId and receiverId cannot be the same
                if (payload.receiverId === id) {
                    console.log('Sender and receiver cannot be the same');
                    socket.emit('error', {
                        message: 'Sender and receiver cannot be the same',
                    });
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
                const chat = yield prisma_1.default.chat.create({
                    data: {
                        senderId: id,
                        receiverId: payload.receiverId,
                        roomId: roomId,
                        message: payload.message,
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
                // Emit updated messageList to both sender and receiver
                const emitMessageList = (userId) => __awaiter(this, void 0, void 0, function* () {
                    // Only fetch rooms where the user is sender or receiver
                    const rooms = yield prisma_1.default.room.findMany({
                        where: {
                            OR: [{ senderId: userId }, { receiverId: userId }],
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
                        var _a, _b, _c, _d, _e;
                        const unReadMessagesCount = yield prisma_1.default.chat.count({
                            where: {
                                roomId: room.id,
                                isRead: false,
                                receiverId: userId,
                            },
                        });
                        return {
                            chat: room.chat[0], // Include only the latest chat
                            unReadMessagesCount,
                            senderName: ((_a = userInfos.find(userInfo => userInfo.id === room.receiverId)) === null || _a === void 0 ? void 0 : _a.fullName) || null,
                            senderImage: ((_b = userInfos.find(userInfo => userInfo.id === room.receiverId)) === null || _b === void 0 ? void 0 : _b.image) || null,
                            receiverName: ((_c = userInfos.find(userInfo => userInfo.id === room.senderId)) === null || _c === void 0 ? void 0 : _c.fullName) || null,
                            receiverImage: ((_d = userInfos.find(userInfo => userInfo.id === room.senderId)) === null || _d === void 0 ? void 0 : _d.image) || null,
                            lastMessageAt: ((_e = room.chat[0]) === null || _e === void 0 ? void 0 : _e.createdAt) || null,
                            roomId: room.id,
                        };
                    })));
                    // Sort so the updated room (the one with the latest message) is on top
                    const sortedRooms = roomsWithUnreadMessages.sort((a, b) => {
                        // Put the room with the latest message on top
                        if (!a.lastMessageAt && !b.lastMessageAt)
                            return 0;
                        if (!a.lastMessageAt)
                            return 1;
                        if (!b.lastMessageAt)
                            return -1;
                        return (new Date(b.lastMessageAt).getTime() -
                            new Date(a.lastMessageAt).getTime());
                    });
                    const targetSocket = userSockets.get(userId);
                    if (targetSocket) {
                        targetSocket.emit('messageList', sortedRooms.length ? sortedRooms : []);
                    }
                });
                // Update messageList for both sender and receiver
                yield emitMessageList(id);
                if (payload.receiverId !== id) {
                    const receiverSocket = userSockets.get(payload.receiverId);
                    if (receiverSocket && receiverSocket.connected) {
                        yield emitMessageList(payload.receiverId);
                    }
                    else {
                        // Optionally, handle offline receiver (e.g., queue notification)
                        console.log('Receiver is not online, cannot emit messageList');
                    }
                }
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
                // Check subscription plan from user token (assumed to be set by socketAuth)
                const subscriptionPlan = user.subscriptionPlan; // e.g., 'free', 'premium', etc.
                const senderRole = user.role; // e.g., 'saloonOwner', 'barber', etc.
                // Fetch receiver's role and info
                const receiver = yield prisma_1.default.user.findUnique({
                    where: { id: payload.receiverId },
                    select: { fullName: true, image: true, role: true },
                });
                if (!receiver) {
                    console.log('Receiver not found');
                    return;
                }
                const receiverRole = receiver.role;
                // If subscription is free, prevent chat between saloon owner and barber or customer
                if (subscriptionPlan === client_1.SubscriptionPlanStatus.FREE &&
                    (senderRole === client_1.UserRoleEnum.SALOON_OWNER ||
                        receiverRole === client_1.UserRoleEnum.SALOON_OWNER)) {
                    socket.emit('error', {
                        message: `Cannot fetch chats between saloon owner and the barber or the customer if saloon owner's subscription is free.`,
                    });
                    return;
                }
                // BASIC_PREMIUM: can only fetch chats with barbers, not customers
                if (subscriptionPlan === client_1.SubscriptionPlanStatus.BASIC_PREMIUM &&
                    receiverRole !== client_1.UserRoleEnum.BARBER) {
                    socket.emit('error', {
                        message: `With BASIC_PREMIUM, you can only fetch chats with barbers.`,
                    });
                    return;
                }
                // ADVANCED_PREMIUM: can only fetch chats with customers, not barbers
                if (subscriptionPlan === client_1.SubscriptionPlanStatus.ADVANCED_PREMIUM &&
                    receiverRole !== client_1.UserRoleEnum.CUSTOMER) {
                    socket.emit('error', {
                        message: `With ADVANCED_PREMIUM, you can only fetch chats with customers.`,
                    });
                    return;
                }
                if (subscriptionPlan === client_1.SubscriptionPlanStatus.PRO_PREMIUM) {
                    // No restriction for PRO_PREMIUM, allow fetching chats (do nothing, just proceed)
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
                // Mark all messages as read before fetching chats
                yield prisma_1.default.chat.updateMany({
                    where: {
                        roomId: room.id,
                        receiverId: id,
                        isRead: false,
                    },
                    data: {
                        isRead: true,
                    },
                });
                const chats = yield prisma_1.default.chat.findMany({
                    where: {
                        roomId: room.id,
                    },
                    orderBy: {
                        createdAt: 'asc',
                    },
                });
                socket.emit('chats', {
                    chats,
                    receiver: {
                        name: (receiver === null || receiver === void 0 ? void 0 : receiver.fullName) || null,
                        image: (receiver === null || receiver === void 0 ? void 0 : receiver.image) || null,
                    },
                });
                // Ensure both users join the room
                const roomName = [id, payload.receiverId].sort().join('-');
                socket.join(roomName);
                const receiverSocket = userSockets.get(payload.receiverId);
                if (receiverSocket) {
                    receiverSocket.join(roomName);
                }
                // Emit updated messageList to the user
                const emitMessageList = (userId) => __awaiter(this, void 0, void 0, function* () {
                    const rooms = yield prisma_1.default.room.findMany({
                        where: {
                            OR: [{ senderId: userId }, { receiverId: userId }],
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
                    const userIds = Array.from(new Set(rooms
                        .map(room => [room.senderId, room.receiverId])
                        .flat()
                        .filter((uid) => !!uid)));
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
                        var _f, _g, _h, _j, _k;
                        const unReadMessagesCount = yield prisma_1.default.chat.count({
                            where: {
                                roomId: room.id,
                                isRead: false,
                                receiverId: userId,
                            },
                        });
                        return {
                            chat: room.chat[0],
                            unReadMessagesCount,
                            senderName: ((_f = userInfos.find(userInfo => userInfo.id === room.receiverId)) === null || _f === void 0 ? void 0 : _f.fullName) || null,
                            senderImage: ((_g = userInfos.find(userInfo => userInfo.id === room.receiverId)) === null || _g === void 0 ? void 0 : _g.image) || null,
                            receiverName: ((_h = userInfos.find(userInfo => userInfo.id === room.senderId)) === null || _h === void 0 ? void 0 : _h.fullName) || null,
                            receiverImage: ((_j = userInfos.find(userInfo => userInfo.id === room.senderId)) === null || _j === void 0 ? void 0 : _j.image) || null,
                            lastMessageAt: ((_k = room.chat[0]) === null || _k === void 0 ? void 0 : _k.createdAt) || null,
                            roomId: room.id,
                        };
                    })));
                    const sortedRooms = roomsWithUnreadMessages.sort((a, b) => {
                        if (!a.lastMessageAt && !b.lastMessageAt)
                            return 0;
                        if (!a.lastMessageAt)
                            return 1;
                        if (!b.lastMessageAt)
                            return -1;
                        return (new Date(b.lastMessageAt).getTime() -
                            new Date(a.lastMessageAt).getTime());
                    });
                    const targetSocket = userSockets.get(userId);
                    if (targetSocket) {
                        targetSocket.emit('messageList', sortedRooms.length ? sortedRooms : []);
                    }
                });
                yield emitMessageList(id);
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
                        subscriptionPlan: true,
                        role: true,
                    },
                });
                let filteredRooms = rooms;
                // Apply filtering based on saloon owner's subscription plan
                if (user.role === client_1.UserRoleEnum.SALOON_OWNER) {
                    if (user.subscriptionPlan === client_1.SubscriptionPlanStatus.BASIC_PREMIUM) {
                        // Only show rooms with barbers
                        filteredRooms = rooms.filter(room => {
                            const otherUserId = room.senderId === id ? room.receiverId : room.senderId;
                            const otherUser = userInfos.find(u => u.id === otherUserId);
                            return (otherUser === null || otherUser === void 0 ? void 0 : otherUser.role) === client_1.UserRoleEnum.BARBER;
                        });
                    }
                    else if (user.subscriptionPlan === client_1.SubscriptionPlanStatus.ADVANCED_PREMIUM) {
                        // Only show rooms with customers
                        filteredRooms = rooms.filter(room => {
                            const otherUserId = room.senderId === id ? room.receiverId : room.senderId;
                            const otherUser = userInfos.find(u => u.id === otherUserId);
                            return (otherUser === null || otherUser === void 0 ? void 0 : otherUser.role) === client_1.UserRoleEnum.CUSTOMER;
                        });
                    }
                    // PRO_PREMIUM: no restriction
                }
                const roomsWithUnreadMessages = yield Promise.all(filteredRooms.map((room) => __awaiter(this, void 0, void 0, function* () {
                    var _l, _m, _o, _p;
                    const unReadMessagesCount = yield prisma_1.default.chat.count({
                        where: {
                            roomId: room.id,
                            isRead: false,
                            receiverId: id,
                        },
                    });
                    const otherUserId = room.senderId === id ? room.receiverId : room.senderId;
                    const otherUser = userInfos.find(u => u.id === otherUserId);
                    return {
                        chat: room.chat[0], // Always include latest chat
                        unReadMessagesCount,
                        senderName: ((_l = userInfos.find(userInfo => userInfo.id === room.receiverId)) === null || _l === void 0 ? void 0 : _l.fullName) || null,
                        senderImage: ((_m = userInfos.find(userInfo => userInfo.id === room.receiverId)) === null || _m === void 0 ? void 0 : _m.image) || null,
                        receiverName: ((_o = userInfos.find(userInfo => userInfo.id === room.senderId)) === null || _o === void 0 ? void 0 : _o.fullName) || null,
                        receiverImage: ((_p = userInfos.find(userInfo => userInfo.id === room.senderId)) === null || _p === void 0 ? void 0 : _p.image) || null,
                        saloonOwnerSubscriptionPlan: user.role === client_1.UserRoleEnum.SALOON_OWNER
                            ? user.subscriptionPlan
                            : null,
                        // Always include the other user's subscription plan name
                        // otherUserSubscriptionPlan: otherUser?.subscriptionPlan || null,
                        // lastMessageAt: room.chat[0]?.createdAt || null,
                        // roomId: room.id,
                    };
                })));
                // Emit all rooms, even if unread count is zero
                socket.emit('messageList', roomsWithUnreadMessages);
            }
            catch (error) {
                console.error('Error fetching messageList:', error);
            }
        }));
    }));
    return io;
}
exports.setupSocketIO = setupSocketIO;
