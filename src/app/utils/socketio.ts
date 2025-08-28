import { verifyToken } from './verifyToken';
import { Server as HTTPServer, Server } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { JwtPayload, Secret } from 'jsonwebtoken';
import config from '../../config';
import prisma from './prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';

const onlineUsers = new Set<string>();
const userSockets = new Map<string, Socket>();

export function setupSocketIO(server: HTTPServer) {
  // const io = new SocketIOServer(server);
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
    },
  });

  const messagesNameSpace = io.of('/messages');

  messagesNameSpace.on('connection', async (socket: Socket) => {
    console.log('A user connected to messages namespace');
    const token = socket.handshake.query.token as string;
    if (!token) {
      console.log('No token provided');
      socket.disconnect();
      return;
    }
    const user = verifyToken(token, config.jwt.access_secret as Secret);
    const { id, role } = user as JwtPayload & { role: string };
    const existingUser = await prisma.user.findUnique({
      where: { id: id, status: UserStatus.ACTIVE },
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

    socket.on('message', async payload => {
      try {
      if (!payload.receiverId || !payload.message) {
        console.log('Receiver ID or message is undefined');
        return;
      }

      // Fetch receiver's role
      const receiver = await prisma.user.findUnique({
        where: { id: payload.receiverId },
        select: { role: true },
      });
      if (!receiver) {
        console.log('Receiver not found');
        return;
      }

      // senderId and receiverId cannot be the same
      if (payload.receiverId === id) {  
        console.log('Sender and receiver cannot be the same');
        socket.emit('error', { message: 'Sender and receiver cannot be the same' });
        return;
      }

      const room = await prisma.room.findFirst({
        where: {
        OR: [
          { senderId: id, receiverId: payload.receiverId },
          { senderId: payload.receiverId, receiverId: id },
        ],
        },
      });
      let roomId;
      if (!room) {
        const newRoom = await prisma.room.create({
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
      } else {
        roomId = room.id;
      }
      const chat = await prisma.chat.create({
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
      const emitMessageList = async (userId: string) => {
        // Only fetch rooms where the user is sender or receiver
        const rooms = await prisma.room.findMany({
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
        const userIds = Array.from(
        new Set(
          rooms
          .map(room => [room.senderId, room.receiverId])
          .flat()
          .filter((uid): uid is string => !!uid),
        ),
        );

        // Fetch user info for all involved users
        const userInfos = await prisma.user.findMany({
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

        const roomsWithUnreadMessages = await Promise.all(
        rooms.map(async room => {
          const unReadMessagesCount = await prisma.chat.count({
          where: {
            roomId: room.id,
            isRead: false,
            receiverId: userId,
          },
          });
          return {
          chat: room.chat[0], // Include only the latest chat
          unReadMessagesCount,
          senderName:
            userInfos.find(userInfo => userInfo.id === room.receiverId)
            ?.fullName || null,
          senderImage:
            userInfos.find(userInfo => userInfo.id === room.receiverId)
            ?.image || null,
          receiverName:
            userInfos.find(userInfo => userInfo.id === room.senderId)
            ?.fullName || null,
          receiverImage:
            userInfos.find(userInfo => userInfo.id === room.senderId)
            ?.image || null,
          lastMessageAt: room.chat[0]?.createdAt || null,
          roomId: room.id,
          };
        }),
        );

        // Sort so the updated room (the one with the latest message) is on top
        const sortedRooms = roomsWithUnreadMessages
        .sort((a, b) => {
          // Put the room with the latest message on top
          if (!a.lastMessageAt && !b.lastMessageAt) return 0;
          if (!a.lastMessageAt) return 1;
          if (!b.lastMessageAt) return -1;
          return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
        });

        const targetSocket = userSockets.get(userId);
        if (targetSocket) {
        targetSocket.emit(
          'messageList',
          sortedRooms.length ? sortedRooms : [],
        );
        }
      };

      // Update messageList for both sender and receiver
      await emitMessageList(id);
      if (payload.receiverId !== id) {
        const receiverSocket = userSockets.get(payload.receiverId);
        if (receiverSocket && receiverSocket.connected) {
          await emitMessageList(payload.receiverId);
        } else {
          // Optionally, handle offline receiver (e.g., queue notification)
          console.log('Receiver is not online, cannot emit messageList');
        }
      }
      } catch (error) {
      console.error('Error handling message event:', error);
      }
    });

    socket.on('fetchChats', async payload => {
      try {
      if (!payload || !payload.receiverId) {
        console.log('Receiver ID is undefined');
        return;
      }
      const room = await prisma.room.findFirst({
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
      const chats = await prisma.chat.findMany({
        where: {
        roomId: room.id,
        },
        orderBy: {
        createdAt: 'asc',
        },
      });
      if (chats) {
        await prisma.chat.updateMany({
        where: {
          roomId: room.id,
        },
        data: {
          isRead: true,
        },
        });
      }

      // Fetch receiver info
      const receiver = await prisma.user.findUnique({
        where: { id: payload.receiverId },
        select: { fullName: true, image: true },
      });

      socket.emit('chats', {
        chats,
        receiver: {
        name: receiver?.fullName || null,
        image: receiver?.image || null,
        },
      });

      // Ensure both users join the room
      const roomName = [id, payload.receiverId].sort().join('-');
      socket.join(roomName);
      const receiverSocket = userSockets.get(payload.receiverId);
      if (receiverSocket) {
        receiverSocket.join(roomName);
      }
      } catch (error) {
      console.error('Error fetching chats:', error);
      }
    });

    socket.on('unReadMessages', async payload => {
      try {
        if (!payload || !payload.receiverId) {
          console.log('Receiver ID is undefined');
          return;
        }
        const room = await prisma.room.findFirst({
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
        const chats = await prisma.chat.findMany({
          where: {
            roomId: room.id,
            isRead: false,
            receiverId: id,
          },
        });
        const unReadMessagesCount = await prisma.chat.count({
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
      } catch (error) {
        console.error('Error fetching unReadMessages:', error);
      }
    });

    socket.on('messageList', async () => {
      try {
        // Only fetch rooms where the user is sender or receiver
        const rooms = await prisma.room.findMany({
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
        const userIds = Array.from(
          new Set(
            rooms
              .map(room => [room.senderId, room.receiverId])
              .flat()
              .filter((uid): uid is string => !!uid),
          ),
        );

        // Fetch user info for all involved users
        const userInfos = await prisma.user.findMany({
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

        const roomsWithUnreadMessages = await Promise.all(
          rooms.map(async room => {
            const unReadMessagesCount = await prisma.chat.count({
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
              senderName:
                userInfos.find(userInfo => userInfo.id === room.receiverId)
                  ?.fullName || null,
              senderImage:
                userInfos.find(userInfo => userInfo.id === room.receiverId)
                  ?.image || null,
              receiverName:
                userInfos.find(userInfo => userInfo.id === room.senderId)
                  ?.fullName || null,
              receiverImage:
                userInfos.find(userInfo => userInfo.id === room.senderId)
                  ?.image || null,
            };
          }),
        );
        socket.emit(
          'messageList',
          roomsWithUnreadMessages.length ? roomsWithUnreadMessages : [],
        );
      } catch (error) {
        console.error('Error fetching messageList:', error);
      }
    });
  });

  return io;
}
