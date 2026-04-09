import prisma from '../../utils/prisma';
import {
  BookingStatus,
  PaymentStatus,
  UserRoleEnum,
  UserStatus,
} from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import {
  calculatePagination,
  formatPaginationResponse,
} from '../../utils/pagination';
import { buildCompleteQuery } from '../../utils/searchFilter';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import config from '../../../config';

const getSaloonFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  const whereClause = buildCompleteQuery(
    {
      searchTerm: options.searchTerm,
      searchFields: ['fullName', 'email', 'phoneNumber'],
    },
    {
      role: UserRoleEnum.SALOON_OWNER,
      ...(options.status
        ? { status: options.status }
        : { status: { not: UserStatus.PENDING } }),
    },
    {
      startDate: options.startDate,
      endDate: options.endDate,
      dateField: 'createdAt',
    },
  );

  // Handle SaloonOwner specific filters
  if (options.isVerified !== undefined) {
    whereClause.SaloonOwner = {
      isVerified: options.isVerified === true,
    };
  }

  const [saloons, total] = await Promise.all([
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
        createdAt: true,
        SaloonOwner: {
          select: {
            userId: true,
            isVerified: true,
            shopAddress: true,
            shopName: true,
            registrationNumber: true,
            shopLogo: true,
            shopImages: true,
            shopVideo: true,
            ratingCount: true,
            avgRating: true,
          },
        },
      },
    }),
    prisma.user.count({
      where: whereClause,
    }),
  ]);

  // Flatten the response so that SaloonOwner fields are at the top level
  const flattenedSaloons = saloons.map(saloon => {
    const { SaloonOwner, ...userFields } = saloon;
    const owner = Array.isArray(SaloonOwner) ? SaloonOwner[0] : SaloonOwner;
    return {
      ...userFields,
      userId: owner?.userId,
      isVerified: owner?.isVerified,
      shopPhoneNumber: userFields.phoneNumber,
      shopAddress: owner?.shopAddress,
      shopName: owner?.shopName,
      registrationNumber: owner?.registrationNumber,
      shopLogo: owner?.shopLogo,
      shopImages: owner?.shopImages,
      shopVideo: owner?.shopVideo,
      ratingCount: owner?.ratingCount || 0,
      avgRating: owner?.avgRating || 0,
    };
  });

  return formatPaginationResponse(flattenedSaloons, total, page, limit);
};

const getNewSaloonFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Only fetch SaloonOwners where isVerified is false
  const whereClause = {
    isVerified: false,
    ...(options.startDate || options.endDate
      ? {
          createdAt: {
            ...(options.startDate ? { gte: options.startDate } : {}),
            ...(options.endDate ? { lte: options.endDate } : {}),
          },
        }
      : {}),
  };

  const [saloons, total] = await Promise.all([
    prisma.saloonOwner.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      select: {
        userId: true,
        isVerified: true,
        shopAddress: true,
        shopName: true,
        registrationNumber: true,
        shopLogo: true,
        shopImages: true,
        shopVideo: true,
        ratingCount: true,
        avgRating: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            status: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.saloonOwner.count({
      where: whereClause,
    }),
  ]);

  // Flatten the response so that user fields and SaloonOwner fields are at the top level
  const flattenedSaloons = saloons.map(saloon => {
    const { user, ...ownerFields } = saloon;
    return {
      ...ownerFields,
      ...user,
      shopPhoneNumber: user.phoneNumber,
      ratingCount: ownerFields.ratingCount || 0,
      avgRating: ownerFields.avgRating || 0,
    };
  });

  return formatPaginationResponse(flattenedSaloons, total, page, limit);
};

const getSaloonByIdFromDb = async (userId: string, saloonOwnerId: string) => {
  const result = await prisma.user.findUnique({
    where: {
      id: saloonOwnerId,
      role: UserRoleEnum.SALOON_OWNER,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      status: true,
      stripeAccountId: true,
      stripeAccountUrl: true,
      SaloonOwner: {
        select: {
          userId: true,
          isVerified: true,
          shopAddress: true,
          shopName: true,
          registrationNumber: true,
          shopLogo: true,
          shopImages: true,
          shopVideo: true,
          ratingCount: true,
          avgRating: true,
          Barber: {
            select: {
              userId: true,
              portfolio: true,
              experienceYears: true,
              skills: true,
              bio: true,
              ratingCount: true,
              avgRating: true,
              user: {
                select: {
                  id: true,
                  image: true,
                  fullName: true,
                  email: true,
                  phoneNumber: true,
                  status: true,
                },
              },
            },
          },
        },
      },
      SaloonSchedule: {
        select: {
          dayOfWeek: true,
          dayName: true,
          openingTime: true,
          closingTime: true,
          isActive: true,
        },
      },
      Service: {
        select: {
          id: true,
          serviceName: true,
          availableTo: true,
          price: true,
          duration: true,
        },
      },
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Saloon not found');
  }
  // Handle SaloonOwner as array or object
  const saloonOwner = Array.isArray(result.SaloonOwner)
    ? result.SaloonOwner[0]
    : result.SaloonOwner;

  //get bank details from the stripe
  // const stripe = require('stripe')(config.stripe.stripe_secret_key);
  let account = null;
  let bankName = null;
  let accountHolderName = null;
  let branchCity = null;
  let branchCode = null;
  let accountNumber = null;

  if (saloonOwner?.isVerified && result.stripeAccountId) {
    // account = await stripe.accounts.retrieve(result.stripeAccountId);

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

  //   const bankAccount: StripeBankAccount | undefined = (
  //     account as StripeAccount
  //   )?.external_accounts?.data?.find(
  //     (acc: StripeBankAccount) => acc.object === 'bank_account',
  //   );
  //   bankName = bankAccount?.bank_name || null;
  //   accountHolderName =
  //     account?.individual?.first_name && account?.individual?.last_name
  //       ? `${account.individual.first_name} ${account.individual.last_name}`
  //       : null;

  //   branchCity = bankAccount?.bank_name || null;
  //   branchCode = bankAccount?.routing_number || null;
  //   accountNumber = bankAccount?.last4 ? `****${bankAccount.last4}` : null;
  }

  return {
    saloonOwnerIdd: result.id,
    fullName: result.fullName,
    email: result.email,
    phoneNumber: result.phoneNumber,
    status: result.status,
    isVerified: saloonOwner?.isVerified || false,
    shopAddress: saloonOwner?.shopAddress || '',
    shopName: saloonOwner?.shopName || '',
    registrationNumber: saloonOwner?.registrationNumber || '',
    shopLogo: saloonOwner?.shopLogo || null,
    shopImages: saloonOwner?.shopImages || [],
    shopVideo: saloonOwner?.shopVideo || null,
    ratingCount: saloonOwner?.ratingCount || 0,
    avgRating: saloonOwner?.avgRating || 0,
    schedule: result.SaloonSchedule || [],
    barbers:
      saloonOwner?.Barber?.map(barber => ({
        barberId: barber.userId,
        Image: barber.user?.image || null,
        fullName: barber.user?.fullName || '',
        email: barber.user?.email || '',
        phoneNumber: barber.user?.phoneNumber || '',
        status: barber.user?.status || 'INACTIVE',
        portfolio: barber.portfolio || [],
        experienceYears: barber.experienceYears || 0,
        skills: barber.skills || [],
        bio: barber.bio || '',
        ratingCount: barber.ratingCount || 0,
        avgRating: barber.avgRating || 0,
      })) || [],
    services: result.Service || [],
    bankDetails: {
      bankName,
      accountHolderName,
      accountNumber,
      branchCity,
      branchCode,
    },
  };
};

const blockSaloonByIdIntoDb = async (saloonOwnerId: string, data: any) => {
  const { status } = data;
  const result = await prisma.saloonOwner.update({
    where: {
      userId: saloonOwnerId,
    },
    data: {
      isVerified: status,
    },
    select: {
      userId: true,
      isVerified: true,
      shopAddress: true,
      shopName: true,
      registrationNumber: true,
      shopLogo: true,
      shopImages: true,
      shopVideo: true,
    },
  });
  if (!result) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Saloon not found or not updated',
    );
  }
  const updateUser = await prisma.user.update({
    where: {
      id: saloonOwnerId,
    },
    data: {
      status: status === true ? UserStatus.ACTIVE : UserStatus.BLOCKED,
    },
  });
  if (!updateUser) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'User status not updated for the saloon owner',
    );
  }

  return result;
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
  // const stripe = require('stripe')(config.stripe.stripe_secret_key);
  let account = null;
  let bankName = null;
  let accountHolderName = null;
  let branchCity = null;
  let branchCode = null;
  let accountNumber = null;

  if (result.stripeAccountId) {
    // account = await stripe.accounts.retrieve(result.stripeAccountId);

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

  //   const bankAccount: StripeBankAccount | undefined = (
  //     account as StripeAccount
  //   )?.external_accounts?.data?.find(
  //     (acc: StripeBankAccount) => acc.object === 'bank_account',
  //   );
  //   bankName = bankAccount?.bank_name || null;
  //   accountHolderName =
  //     account?.individual?.first_name && account?.individual?.last_name
  //       ? `${account.individual.first_name} ${account.individual.last_name}`
  //       : null;

  //   branchCity = bankAccount?.bank_name || null;
  //   branchCode = bankAccount?.routing_number || null;
  //   accountNumber = bankAccount?.last4 ? `****${bankAccount.last4}` : null;
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

const blockBarberByIdIntoDb = async (
  userId: string,
  barberId: string,
  data: any,
) => {
  const result = await prisma.user.update({
    where: {
      id: barberId,
      role: UserRoleEnum.BARBER,
    },
    data: {
      status: data.status === true ? UserStatus.BLOCKED : UserStatus.ACTIVE,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      status: true,
      createdAt: true,
      Barber: {
        select: {
          userId: true,
          portfolio: true,
          experienceYears: true,
          skills: true,
          bio: true,
        },
      },
    },
  });
  if (!result) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Barber not found or not updated',
    );
  }
  return result;
};

const getCustomersListFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  const whereClause = buildCompleteQuery(
    {
      searchTerm: options.searchTerm,
      searchFields: ['fullName', 'email', 'phoneNumber'],
    },
    {
      role: UserRoleEnum.CUSTOMER,
      status: options.status,
    },
    {
      startDate: options.startDate,
      endDate: options.endDate,
      dateField: 'createdAt',
    },
  );

  const [customers, total] = await Promise.all([
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
        gender: true,
        address: true,
        image: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.user.count({
      where: whereClause,
    }),
  ]);

  return formatPaginationResponse(customers, total, page, limit);
};

const blockCustomerByIdIntoDb = async (
  userId: string,
  customerId: string,
  data: any,
) => {
  const result = await prisma.user.update({
    where: {
      id: customerId,
      role: UserRoleEnum.CUSTOMER,
    },
    data: {
      status: data.status === true ? UserStatus.BLOCKED : UserStatus.ACTIVE,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      image: true,
      status: true,
      createdAt: true,
    },
  });
  if (!result) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Customer not found or not updated',
    );
  }
  return result;
};

const updateSaloonOwnerByIdIntoDb = async (
  userId: string,
  saloonOwnerId: string,
  data: any,
) => {
  const { status } = data;
  const saloonOwner = await prisma.saloonOwner.update({
    where: {
      userId: saloonOwnerId,
    },
    data: {
      isVerified: status === true ? true : false,
    },
  });
  if (!saloonOwner) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Saloon owner not found or not updated',
    );
  }
  return saloonOwner;
};

const getAdminDashboardFromDb = async (userId: string) => {
  const saloonCount = await prisma.saloonOwner.count({
    where: {
      isVerified: true,
    },
  });

  const barberCount = await prisma.user.count({
    where: {
      role: UserRoleEnum.BARBER,
      status: UserStatus.ACTIVE,
    },
  });

  const customerCount = await prisma.user.count({
    where: {
      role: UserRoleEnum.CUSTOMER,
      status: UserStatus.ACTIVE,
    },
  });

  const totalEarnings = await prisma.payment.aggregate({
    _sum: {
      paymentAmount: true,
    },
    where: {
      status: PaymentStatus.COMPLETED,
    },
  });

  const earningGrowth = await prisma.payment.groupBy({
    by: ['createdAt'],
    _sum: {
      paymentAmount: true,
    },
    where: {
      status: 'COMPLETED',
      createdAt: {
        gte: new Date(new Date().setMonth(new Date().getMonth() - 1)), // Last month
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const userGrowth = await prisma.user.groupBy({
    by: ['createdAt', 'role'],
    _count: {
      id: true,
    },
    where: {
      role: {
        in: [
          UserRoleEnum.SALOON_OWNER,
          UserRoleEnum.BARBER,
          UserRoleEnum.CUSTOMER,
        ],
      },
      status: UserStatus.ACTIVE,
      createdAt: {
        gte: new Date(new Date().setMonth(new Date().getMonth() - 1)), // Last month
      },
    },
    orderBy: [{ createdAt: 'asc' }, { role: 'asc' }],
  });

  // Prepare last 12 months labels
  interface MonthEarning {
    label: string;
    year: number;
    month: number;
    total: number;
  }
  const months: MonthEarning[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleString('default', { month: 'short', year: 'numeric' }), // e.g. "Jan 2024"
      year: d.getFullYear(),
      month: d.getMonth(),
      total: 0,
    });
  }

  // Map earningGrowth to month index
  earningGrowth.forEach(item => {
    const date = new Date(item.createdAt);
    const idx = months.findIndex(
      m => m.year === date.getFullYear() && m.month === date.getMonth(),
    );
    if (idx !== -1) {
      months[idx].total += item._sum.paymentAmount || 0;
    }
  });

  // Prepare user growth per month with month name
  const userGrowthByMonth: { month: string; role: string; count: number }[] =
    [];
  months.forEach(month => {
    ['SALOON_OWNER', 'BARBER', 'CUSTOMER'].forEach(role => {
      const count = userGrowth
        .filter(
          item =>
            item.role === role &&
            item.createdAt.getFullYear() === month.year &&
            item.createdAt.getMonth() === month.month,
        )
        .reduce((sum, item) => sum + item._count.id, 0);
      userGrowthByMonth.push({
        month: month.label,
        role,
        count,
      });
    });
  });

  return {
    saloonCount,
    barberCount,
    customerCount,
    totalEarnings: totalEarnings._sum.paymentAmount || 0,
    earningGrowth: months.map(m => ({
      month: m.label,
      total: m.total,
    })),
    userGrowth: userGrowthByMonth.map(item => ({
      date: item.month, // Use the month label as the date
      role: item.role,
      count: item.count,
    })),
  };
};

const getSubscribersListFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build common where clause for search, filtering by date
  const whereClause = buildCompleteQuery(
    {
      searchTerm: options.searchTerm,
      searchFields: ['fullName', 'email', 'phoneNumber'],
    },
    {
      role: UserRoleEnum.SALOON_OWNER,
      status: UserStatus.ACTIVE,
    },
    {
      startDate: options.startDate,
      endDate: options.endDate,
      dateField: 'createdAt',
    },
  );

  const [subscribers, total] = await Promise.all([
    prisma.user.findMany({
      where: {
        ...whereClause,
        UserSubscription: {
          some: {
            paymentStatus: PaymentStatus.COMPLETED, // Active subscription
            // endDate: { gte: new Date() }, // Not expired
          },
        },
        Payment: {
          some: {
            status: PaymentStatus.COMPLETED,
          },
        },
      },
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        subscriptionEnd: true,
        UserSubscription: {
          where: {
            paymentStatus: PaymentStatus.COMPLETED,
            endDate: { gte: new Date() },
          },
          orderBy: {
            endDate: 'desc',
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            // stripeSubscriptionId: true,
            paymentStatus: true,
            subscriptionOffer: {
              select: {
                id: true,
                title: true,
                description: true,
                price: true,
                currency: true,
                duration: true,
              },
            },
          },
        },
        Payment: {
          where: {
            status: PaymentStatus.COMPLETED,
          },
          orderBy: {
            paymentDate: 'desc',
          },
          take: 1,
          select: {
            id: true,
            paymentAmount: true,
            paymentDate: true,
            status: true,
            paymentIntentId: true,
          },
        },
      },
    }),
    prisma.user.count({
      where: {
        ...whereClause,
        UserSubscription: {
          some: {
            paymentStatus: PaymentStatus.COMPLETED,
            endDate: { gte: new Date() },
          },
        },
        Payment: {
          some: {
            status: PaymentStatus.COMPLETED,
          },
        },
      },
    }),
  ]);

  // Flatten the response so that subscription fields are at the top level
  const flattenedSubscribers = subscribers.map(subscriber => {
    const subscription = subscriber.UserSubscription?.[0];
    const latestPayment = subscriber.Payment?.[0];
    return {
      id: subscriber.id,
      fullName: subscriber.fullName,
      email: subscriber.email,
      phoneNumber: subscriber.phoneNumber,
      subscriptionId: subscription?.id || null,
      startDate: subscription?.startDate || null,
      endDate: subscription?.endDate || null,
      subscriptionEnd: subscriber.subscriptionEnd || null,
      // stripeSubscriptionId: subscription?.stripeSubscriptionId || null,
      paymentStatus: subscription?.paymentStatus || null,
      expired: subscription?.endDate ? subscription.endDate < new Date() : false,
      offer: subscription?.subscriptionOffer
        ? {
            id: subscription.subscriptionOffer.id,
            title: subscription.subscriptionOffer.title,
            description: subscription.subscriptionOffer.description,
            price: subscription.subscriptionOffer.price,
            currency: subscription.subscriptionOffer.currency,
            duration: subscription.subscriptionOffer.duration,
          }
        : null,
      latestPayment: latestPayment
        ? {
            id: latestPayment.id,
            amount: latestPayment.paymentAmount,
            paymentDate: latestPayment.paymentDate,
            status: latestPayment.status,
            paymentIntentId: latestPayment.paymentIntentId,
          }
        : null,
    };
  
  
  });


  return formatPaginationResponse(flattenedSubscribers, total, page, limit);
};


export const adminService = {
  getSaloonFromDb,
  getNewSaloonFromDb,
  getSaloonByIdFromDb,
  blockSaloonByIdIntoDb,
  getBarbersListFromDb,
  getBarberByIdFromDb,
  blockBarberByIdIntoDb,
  getCustomersListFromDb,
  blockCustomerByIdIntoDb,
  updateSaloonOwnerByIdIntoDb,
  getAdminDashboardFromDb,
  getSubscribersListFromDb,
};
