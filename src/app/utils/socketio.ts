import { verifyToken } from './verifyToken';
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { JwtPayload, Secret } from 'jsonwebtoken';
import config from '../../config';
import prisma from './prisma';
import { UserRoleEnum } from '@prisma/client';

const onlineUsers = new Set<string>();
const userSockets = new Map<string, Socket>();

export function setupSocketIO(server: HTTPServer) {
  const io = new SocketIOServer(server);
  
  
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

        // Enforce customer-initiated chat with saloon owner
        if (
          role === UserRoleEnum.SALOON_OWNER &&
          receiver.role === UserRoleEnum.CUSTOMER
        ) {
          // Check if a room already exists
          const existingRoom = await prisma.room.findFirst({
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
        // if (
        //   payload.images &&
        //   (!Array.isArray(payload.images) || payload.images.length === 0)
        // ) {
        //   console.log('Images array is null');
        // }
        const chat = await prisma.chat.create({
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
        socket.emit('chats', chats);
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

        // Only show chats relevant to the user
        const receiverIds = rooms
          .map(room => {
            if (room.senderId === id) {
              return room.receiverId;
            }
            return room.senderId;
          })
          .filter((uid): uid is string => uid !== null && uid !== undefined);

        const userInfos = await prisma.user.findMany({
          where: {
            id: {
              in: receiverIds,
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
              sender: userInfos.find(userInfo => userInfo.id === room.senderId),
              receiver: userInfos.find(
                userInfo => userInfo.id === room.receiverId,
              ),
              unReadMessagesCount,
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

  return io
}