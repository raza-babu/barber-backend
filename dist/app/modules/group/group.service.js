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
exports.groupService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const createGroupIntoDb = (userId, groupData) => __awaiter(void 0, void 0, void 0, function* () {
    const { data, groupImage } = groupData;
    const result = yield prisma_1.default.room.create({
        data: Object.assign(Object.assign({}, data), { groupImage: groupImage, creatorId: userId, participants: {
                create: {
                    userId: userId, // Add the creator as the first participant
                },
            } }),
        include: {
            participants: true,
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Group not created');
    }
    return result;
});
const getGroupListFromDb = () => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.room.findMany({
        include: {
            participants: {
                include: {
                    user: {
                        select: {
                            image: true,
                        },
                    },
                },
            },
        },
    });
    if (result.length === 0) {
        return { message: 'No group found' };
    }
    const groupsWithParticipantDetails = result.map(group => (Object.assign(Object.assign({}, group), { participants: group.participants.map(participant => (Object.assign({}, participant))), participantCount: group.participants.length })));
    return groupsWithParticipantDetails;
});
const getGroupByIdFromDb = (groupId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.room.findUnique({
        where: {
            id: groupId,
        },
        include: {
            participants: true,
            chat: true,
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Group not found');
    }
    return result;
});
const updateGroupIntoDb = (userId, groupId, groupData) => __awaiter(void 0, void 0, void 0, function* () {
    const { data, groupImage } = groupData;
    const result = yield prisma_1.default.room.update({
        where: {
            id: groupId,
            creatorId: userId,
        },
        data: Object.assign(Object.assign({}, data), { groupImage: groupImage }),
        include: {
            participants: true,
            chat: true,
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Group not updated');
    }
    return result;
});
const deleteGroupItemFromDb = (userId, groupId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const deletedItem = yield prisma_1.default.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
            // Step 1: Delete all related chats
            yield prisma.chat.deleteMany({
                where: { roomId: groupId },
            });
            // Step 2: Delete all related room participants
            yield prisma.roomUser.deleteMany({
                where: { roomId: groupId },
            });
            // Step 3: Delete the room (group)
            const deletedRoom = yield prisma.room.delete({
                where: {
                    id: groupId,
                    creatorId: userId,
                },
            });
            if (!deletedRoom) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Group not found or you are not the creator');
            }
            return deletedRoom;
        }));
        return deletedItem;
    }
    catch (error) {
        if (error instanceof AppError_1.default) {
            throw error;
        }
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to delete group and related data');
    }
});
exports.groupService = {
    createGroupIntoDb,
    getGroupListFromDb,
    getGroupByIdFromDb,
    updateGroupIntoDb,
    deleteGroupItemFromDb,
};
