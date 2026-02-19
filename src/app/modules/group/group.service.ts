import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createGroupIntoDb = async (userId: string, groupData: any) => {
  const { data, groupImage } = groupData;

  const result = await prisma.room.create({
    data: {
      ...data,
      groupImage: groupImage,
      creatorId: userId,
      participants: {
        create: {
          userId: userId, // Add the creator as the first participant
        },
      },
    },
    include: {
      participants: true,
    },
  });

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Group not created');
  }

  return result;
};

const getGroupListFromDb = async () => {
  const result = await prisma.room.findMany({
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

  const groupsWithParticipantDetails = result.map(group => ({
    ...group,
    participants: group.participants.map(participant => ({
      ...participant,
    })),
    participantCount: group.participants.length,
  }));

  return groupsWithParticipantDetails;
};

const getGroupByIdFromDb = async (groupId: string) => {
  const result = await prisma.room.findUnique({
    where: {
      id: groupId,
    },
    include: {
      participants: true,
      chat: true,
    },
  });

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Group not found');
  }

  return result;
};

const updateGroupIntoDb = async (
  userId: string,
  groupId: string,
  groupData: any,
) => {
  const { data, groupImage } = groupData;

  const result = await prisma.room.update({
    where: {
      id: groupId,
      creatorId: userId,
    },
    data: {
      ...data,
      groupImage: groupImage,
    },
    include: {
      participants: true,
      chat: true,
    },
  });

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Group not updated');
  }

  return result;
};

const deleteGroupItemFromDb = async (userId: string, groupId: string) => {
  try {
    const deletedItem = await prisma.$transaction(async prisma => {
      // Step 1: Delete all related chats
      await prisma.chat.deleteMany({
        where: { roomId: groupId },
      });

      // Step 2: Delete all related room participants
      await prisma.roomUser.deleteMany({
        where: { roomId: groupId },
      });

      // Step 3: Delete the room (group)
      const deletedRoom = await prisma.room.delete({
        where: {
          id: groupId,
          creatorId: userId,
        },
      });

      if (!deletedRoom) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Group not found or you are not the creator',
        );
      }

      return deletedRoom;
    });

    return deletedItem;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to delete group and related data',
    );
  }
};

const getBarbersListFromDb = async (options: ISearchAndFilterOptions) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  const whereClause = buildCompleteQuery(
    {
      searchTerm: options.searchTerm,
      searchFields: ['fullName', 'email', 'phoneNumber'],
    },
    {
      role: UserRoleEnum.BARBER,
      status: options.status,
    },
    {
      startDate: options.startDate,
      endDate: options.endDate,
      dateField: 'createdAt',
    },
  );

  // Handle Barber specific filters
  if (options.experienceYears !== undefined) {
    whereClause.Barber = {
      experienceYears: {
        gte: Number(options.experienceYears),
      },
    };
  }

  const [barbers, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        status: true,
        Barber: {
          select: {
            userId: true,
            portfolio: true,
            experienceYears: true,
            skills: true,
            bio: true,
            ratingCount: true,
            avgRating: true,
            saloonOwner: {
              select: {
                id: true,
                shopName: true,
                shopAddress: true,
              },
            },
            HiredBarber: {
              select: {
                id: true,
                hourlyRate: true,
              },
            },        
          },
        },
      },
    }),
    prisma.user.count({
      where: whereClause,
    }),
  ]);

  // Flatten the response so that Barber fields are at the top level
  const flattenedBarbers = barbers.map(barber => {
    const {Barber, ...userFields } = barber;
    return {
      ...userFields,
      userId: Barber?.userId || userFields.id,
      portfolio: Barber?.portfolio,
      experienceYears: Barber?.experienceYears,
      skills: Barber?.skills,
      bio: Barber?.bio,
      hourlyRate: Barber?.HiredBarber?.[0]?.hourlyRate || null,
      shopId: Barber?.saloonOwner?.id ?? null,
      shopName: Barber?.saloonOwner?.shopName ?? null,
      shopAddress: Barber?.saloonOwner?.shopAddress ?? null,
    };
  });

  return formatPaginationResponse(flattenedBarbers, total, page, limit);
};

const getBarberByIdFromDb = async (userId: string, barberId: string) => {
  const result = await prisma.user.findUnique({
    where: {
      id: barberId,
      role: UserRoleEnum.BARBER,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      status: true,
      stripeAccountId: true,
      stripeAccountUrl: true,
      createdAt: true,
      Barber: {
        select: {
          userId: true,
          portfolio: true,
          experienceYears: true,
          skills: true,
          bio: true,
          ratingCount: true,
          avgRating: true,
          saloonOwner: {
            select: {
              id: true,
              shopName: true,
              shopAddress: true,
              shopLogo: true,
              shopImages: true,
              shopVideo: true,
            },
          },
        },
      },
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Barber not found');
  }

  //get bank details from the stripe
  const stripe = require('stripe')(config.stripe.stripe_secret_key);
  let account = null;
  let bankName = null;
  let accountHolderName = null;
  let branchCity = null;
  let branchCode = null;
  let accountNumber = null;

  if (result.stripeAccountId) {
    account = await stripe.accounts.retrieve(result.stripeAccountId);

    // Stripe external_accounts may contain bank details
    interface StripeBankAccount {
      object: string;
      bank_name?: string;
      routing_number?: string;
      last4?: string;
      [key: string]: any;
    }

    interface StripeExternalAccounts {
      data?: StripeBankAccount[];
      [key: string]: any;
    }

    interface StripeAccount {
      external_accounts?: StripeExternalAccounts;
      [key: string]: any;
    }

    const bankAccount: StripeBankAccount | undefined = (
      account as StripeAccount
    )?.external_accounts?.data?.find(
      (acc: StripeBankAccount) => acc.object === 'bank_account',
    );
    bankName = bankAccount?.bank_name || null;
    accountHolderName =
      account?.individual?.first_name && account?.individual?.last_name
        ? `${account.individual.first_name} ${account.individual.last_name}`
        : null;

    branchCity = bankAccount?.bank_name || null;
    branchCode = bankAccount?.routing_number || null;
    accountNumber = bankAccount?.last4 ? `****${bankAccount.last4}` : null;
  }

  return {
    barberIdd: result.id,
    fullName: result.fullName,
    email: result.email,
    phoneNumber: result.phoneNumber,
    status: result.status,
    portfolio: result.Barber?.portfolio || [],
    experienceYears: result.Barber?.experienceYears || 0,
    skills: result.Barber?.skills || [],
    bio: result.Barber?.bio || '',
    shopId: result.Barber?.saloonOwner?.id || null,
    shopName: result.Barber?.saloonOwner?.shopName || null,
    shopAddress: result.Barber?.saloonOwner?.shopAddress || null,
    shopLogo: result.Barber?.saloonOwner?.shopLogo || null,
    shopImages: result.Barber?.saloonOwner?.shopImages || [],
    shopVideo: result.Barber?.saloonOwner?.shopVideo || null,
    ratingCount: result.Barber?.ratingCount || 0,
    avgRating: result.Barber?.avgRating || 0,
    bankDetails: {
      bankName,
      accountHolderName,
      accountNumber,
      branchCity,
      branchCode,
    },
  };
};

export const groupService = {
  createGroupIntoDb,
  getGroupListFromDb,
  getGroupByIdFromDb,
  updateGroupIntoDb,
  deleteGroupItemFromDb,
};
