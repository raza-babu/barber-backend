import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { BookingStatus, BookingType, Prisma } from '@prisma/client';

const createCustomerIntoDb = async (userId: string, data: any) => {
  const result = await prisma.saloonOwner.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'customer not created');
  }
  return result;
};

const getAllSaloonListFromDb = async (
  userId: string,
  query: {
    searchTerm?: string;
    page?: number;
    limit?: number;
    sortBy?: 'name' | 'rating' | 'newest';
    minRating?: number;
  },
) => {
  const {
    searchTerm = '',
    page = 1,
    limit = 10,
    sortBy = 'name',
    minRating,
  } = query;

  const skip = (page - 1) * limit;

  // Build where clause
  const where: any = {
    isVerified: true,
  };

  if (searchTerm) {
    where.OR = [
      { shopName: { contains: searchTerm, mode: 'insensitive' } },
      { shopAddress: { contains: searchTerm, mode: 'insensitive' } },
    ];
  }

  if (minRating) {
    where.avgRating = { gte: minRating };
  }

  // Build orderBy clause
  let orderBy: any = {};
  switch (sortBy) {
    case 'rating':
      orderBy = { avgRating: 'desc' };
      break;
    case 'newest':
      orderBy = { createdAt: 'desc' };
      break;
    default:
      orderBy = { shopName: 'asc' };
  }

  // Get total count
  const total = await prisma.saloonOwner.count({ where });

  // Get paginated results
  const result = await prisma.saloonOwner.findMany({
    where,
    select: {
      id: true,
      userId: true,
      shopName: true,
      shopAddress: true,
      shopImages: true,
      isVerified: true,
      shopLogo: true,
      shopVideo: true,
      latitude: true,
      longitude: true,
      ratingCount: true,
      avgRating: true,
      Booking: {
        where: {
          bookingType: BookingType.QUEUE,
          status: {
            in: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
          },
        },
      },
      FavoriteShop: { select: { id: true, userId: true } },
    },
    orderBy,
    skip,
    take: limit,
  });

  // check for favorite shop or not
  let isFavoriteShop = false;
  if (userId) {
    result.forEach(saloon => {
      isFavoriteShop = saloon.FavoriteShop.some(fav => fav.userId === userId);
      (saloon as any).isFavorite = isFavoriteShop;
      delete (saloon as any).FavoriteShop;
    });
  } else {
    result.forEach(saloon => {
      (saloon as any).isFavorite = false;
      delete (saloon as any).FavoriteShop;
    });
  }

  const saloons = result.map(({ Booking, ...rest }) => ({
    ...rest,
    distance: 0,
    queue: Array.isArray(Booking) ? Booking.length : 0,
    // isFavoriteShop: (rest as any).isFavorite || false,
  }));

  return {
    data: saloons,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// All saloons near get within a radius
const getMyNearestSaloonListFromDb = async (
  userId: string,
  latitude: number,
  longitude: number,
  query: {
    radius?: number;
    searchTerm?: string;
    page?: number;
    limit?: number;
    minRating?: number;
  } = {},
) => {
  const {
    radius = 50,
    searchTerm = '',
    page = 1,
    limit = 10,
    minRating,
  } = query;

  const radiusInKm = radius;

  // Build where clause
  const where: any = {
    isVerified: true,
    latitude: { not: null },
    longitude: { not: null },
  };

  if (searchTerm) {
    where.OR = [
      { shopName: { contains: searchTerm, mode: 'insensitive' } },
      { shopAddress: { contains: searchTerm, mode: 'insensitive' } },
    ];
  }

  if (minRating) {
    where.avgRating = { gte: minRating };
  }

  // Get all verified saloons
  const allSaloons = await prisma.saloonOwner.findMany({
    where,
    select: {
      id: true,
      userId: true,
      shopName: true,
      shopAddress: true,
      shopImages: true,
      shopLogo: true,
      shopVideo: true,
      latitude: true,
      longitude: true,
      ratingCount: true,
      avgRating: true,
      Booking: {
        where: {
          bookingType: BookingType.QUEUE,
          status: {
            in: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
          },
        },
      },
      FavoriteShop: { select: { id: true, userId: true } },
    },
  });
  // check for favorite shop or not
  let isFavoriteShop = false;
  if (userId) {
    allSaloons.forEach(saloon => {
      isFavoriteShop = saloon.FavoriteShop.some(fav => fav.userId === userId);
      (saloon as any).isFavorite = isFavoriteShop;
      delete (saloon as any).FavoriteShop;
    });
  } else {
    allSaloons.forEach(saloon => {
      (saloon as any).isFavorite = false;
      delete (saloon as any).FavoriteShop;
    });
  }

  // Haversine formula to calculate distance
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  // Filter and sort saloons by distance
  const nearbySaloons = allSaloons
    .map(saloon => {
      const distance = calculateDistance(
        latitude,
        longitude,
        Number(saloon.latitude),
        Number(saloon.longitude),
      );

      const { Booking, ...rest } = saloon;
      return {
        ...rest,
        distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
        queue: Array.isArray(Booking) ? Booking.length : 0,
        // isFavoriteShop: (rest as any).isFavorite || false,
      };
    })
    .filter(saloon => saloon.distance <= radiusInKm)
    .sort((a, b) => a.distance - b.distance);

  // Apply pagination
  const total = nearbySaloons.length;
  const skip = (page - 1) * limit;
  const paginatedSaloons = nearbySaloons.slice(skip, skip + limit);

  return {
    data: paginatedSaloons,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getTopRatedSaloonsFromDb = async (
  userId: string,
  query: {
    searchTerm?: string;
    page?: number;
    limit?: number;
    minRating?: number;
  },
) => {
  const { searchTerm = '', page = 1, limit = 10, minRating } = query;

  // Build where clause
  const where: any = {
    isVerified: true,
  };

  if (searchTerm) {
    where.OR = [
      { shopName: { contains: searchTerm, mode: 'insensitive' } },
      { shopAddress: { contains: searchTerm, mode: 'insensitive' } },
    ];
  }

  if (minRating) {
    where.avgRating = { gte: minRating };
  }

  // Get total count
  const total = await prisma.saloonOwner.count({ where });

  // Get results
  const result = await prisma.saloonOwner.findMany({
    where,
    select: {
      id: true,
      userId: true,
      shopName: true,
      shopAddress: true,
      shopImages: true,
      shopLogo: true,
      shopVideo: true,
      latitude: true,
      longitude: true,
      ratingCount: true,
      avgRating: true,
      Review: {
        select: {
          rating: true,
        },
      },
      Booking: {
        where: {
          bookingType: BookingType.QUEUE,
          status: {
            in: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
          },
        },
      },
      FavoriteShop: { select: { id: true, userId: true } },
    },
  });
  // check for favorite shop or not
  let isFavoriteShop = false;
  if (userId) {
    result.forEach(saloon => {
      isFavoriteShop = saloon.FavoriteShop.some(fav => fav.userId === userId);
      (saloon as any).isFavorite = isFavoriteShop;
      delete (saloon as any).FavoriteShop;
    });
  } else {
    result.forEach(saloon => {
      (saloon as any).isFavorite = false;
      delete (saloon as any).FavoriteShop;
    });
  }

  // Normalize output to the requested format and sort by avgRating desc
  const saloonsWithAvgRatings = result
    .map(saloon => {
      const reviews = Array.isArray((saloon as any).Review)
        ? (saloon as any).Review
        : [];

      const ratingsArray = reviews
        .map((r: any) => {
          const val = r && typeof r.rating !== 'undefined' ? r.rating : null;
          return typeof val === 'number' ? val : Number(val);
        })
        .filter((n: number) => !isNaN(n));

      const computedAvg =
        ratingsArray.length > 0
          ? ratingsArray.reduce((s: number, v: number) => s + v, 0) /
            ratingsArray.length
          : typeof saloon.avgRating === 'number'
            ? saloon.avgRating
            : 0;

      const ratingCount =
        typeof saloon.ratingCount === 'number'
          ? saloon.ratingCount
          : ratingsArray.length;

      return {
        id: saloon.id,
        userId: saloon.userId,
        shopName: saloon.shopName,
        shopAddress: saloon.shopAddress,
        shopImages: saloon.shopImages ?? [],
        shopLogo: saloon.shopLogo ?? null,
        shopVideo: saloon.shopVideo ?? [],
        latitude:
          saloon.latitude !== null && typeof saloon.latitude !== 'undefined'
            ? Number(saloon.latitude)
            : null,
        longitude:
          saloon.longitude !== null && typeof saloon.longitude !== 'undefined'
            ? Number(saloon.longitude)
            : null,
        ratingCount: ratingCount,
        avgRating: Math.round(computedAvg * 100) / 100,
        distance: 0,
        queue: saloon.Booking.length,
        isFavorite: (saloon as any).isFavorite || false,
      };
    })
    .sort((a, b) => b.avgRating - a.avgRating);

  // Apply pagination
  const skip = (page - 1) * limit;
  const paginatedSaloons = saloonsWithAvgRatings.slice(skip, skip + limit);

  return {
    data: paginatedSaloons,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const addSaloonToFavoritesInDb = async (
  userId: string,
  saloonOwnerId: string,
) => {
  //check the saloon is exist or not
  const saloon = await prisma.saloonOwner.findUnique({
    where: {
      userId: saloonOwnerId,
    },
  });
  if (!saloon) {
    throw new AppError(httpStatus.NOT_FOUND, 'Saloon not found');
  }

  // Check if the favorite already exists

  const existingFavorite = await prisma.favoriteShop.findFirst({
    where: {
      userId: userId,
      saloonOwnerId: saloonOwnerId,
    },
  });

  if (existingFavorite) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Saloon already in favorites');
  }
  const result = await prisma.favoriteShop.create({
    data: {
      userId: userId,
      saloonOwnerId: saloonOwnerId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Saloon not added to favorites');
  }
  return result;
};

const getFavoriteSaloonsFromDb = async (
  userId: string,
  query: {
    page?: number;
    limit?: number;
  } = {},
) => {
  const { page = 1, limit = 10 } = query;

  const skip = (page - 1) * limit;

  // Get total count
  const total = await prisma.favoriteShop.count({
    where: {
      userId: userId,
    },
  });

  // Get paginated results
  const result = await prisma.favoriteShop.findMany({
    where: {
      userId: userId,
    },
    include: {
      saloonOwner: {
        select: {
          id: true,
          userId: true,
          shopName: true,
          shopAddress: true,
          shopImages: true,
          shopLogo: true,
          shopVideo: true,
          latitude: true,
          longitude: true,
          ratingCount: true,
          avgRating: true,
        },
      },
    },
    skip,
    take: limit,
    orderBy: {
      createdAt: 'desc',
    },
  });

  const favorites = result.map(fav => fav.saloonOwner);

  return {
    data: favorites,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const removeSaloonFromFavoritesInDb = async (
  userId: string,
  saloonOwnerId: string,
) => {
  // Check if the favorite exists
  const existingFavorite = await prisma.favoriteShop.findFirst({
    where: {
      userId: userId,
      saloonOwnerId: saloonOwnerId,
    },
  });
  if (!existingFavorite) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Saloon not found in favorites');
  }
  const deletedItem = await prisma.favoriteShop.delete({
    where: {
      userId_saloonOwnerId: {
        userId: userId,
        saloonOwnerId: saloonOwnerId,
      },
    },
  });
  if (!deletedItem) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Saloon not removed from favorites',
    );
  }

  return deletedItem;
};

const getSaloonAllServicesListFromDb = async (saloonOwnerId: string) => {
  const result = await prisma.service.findMany({
    where: {
      saloonOwnerId: saloonOwnerId,
      isActive: true,
    },
    select: {
      id: true,
      serviceName: true,
      price: true,
      duration: true,
      saloonOwnerId: true,
      user: {
        select: {
          SaloonOwner: {
            select: {
              userId: true,
              shopName: true,
              shopLogo: true,
              shopAddress: true,
            },
          },
        },
      },
    },
  });
  if (result.length === 0) {
    return [];
  }
  return result.map(service => {
    const saloon = service.user?.SaloonOwner?.[0];
    return {
      id: service.id,
      name: service.serviceName,
      price: service.price,
      duration: service.duration,
      // isActive: service.isActive,
      saloonOwnerId: service.saloonOwnerId,
      saloon: saloon
        ? {
            saloonId: saloon.userId,
            shopName: saloon.shopName,
            shopLogo: saloon.shopLogo,
            shopAddress: saloon.shopAddress,
          }
        : null,
    };
  });
};

const getVisitedSaloonListFromDb = async (
  userId: string,
  query: {
    page?: number;
    limit?: number;
  } = {},
) => {
  const { page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  // Get all visited saloonOwnerIds for the user (deduplicated)
  const allVisits = await prisma.customerVisit.findMany({
    where: {
      customerId: userId,
    },
    select: {
      saloonOwnerId: true,
      customer: {
        select: {
          fullName: true,
          email: true,
          phoneNumber: true,
          image: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const distinctSaloonIds = Array.from(
    new Set(allVisits.map(v => v.saloonOwnerId)),
  ).filter(Boolean) as string[];

  const total = distinctSaloonIds.length;

  // Apply pagination on distinct saloon ids
  const pagedSaloonIds = distinctSaloonIds.slice(skip, skip + limit);
  if (pagedSaloonIds.length === 0) {
    return {
      data: [],
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get the latest visit record per saloon for this user (to provide visit detail like lastVisited)
  const visits = await prisma.customerVisit.findMany({
    where: {
      customerId: userId,
      saloonOwnerId: { in: pagedSaloonIds },
    },
    // select minimal safe fields; adjust if your model has other visit fields you want to expose
    select: {
      saloonOwnerId: true,
      createdAt: true, // used as lastVisitedAt
      // If your CustomerVisit has a visitCount or totalVisits field, add it here, e.g. visitCount: true
      saloon: {
        select: {
          userId: true,
          shopName: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Get loyalty info for these saloons in a single query
  const loyalties = await prisma.customerLoyalty.findMany({
    where: {
      userId,
      saloonOwnerId: { in: pagedSaloonIds },
    },
    select: {
      saloonOwnerId: true,
      totalPoints: true,
      // add other loyalty fields you need, e.g. tier: true
    },
  });

  const loyaltyBySaloon = loyalties.reduce<Record<string, any>>((acc, l) => {
    acc[l.saloonOwnerId] = l;
    return acc;
  }, {});

  // Build final list preserving pagination order
    const loyaltySchemes = await prisma.loyaltyScheme.findMany({
      where: {
        userId: { in: pagedSaloonIds },
      },
      select: {
        userId: true,
        pointThreshold: true,
        percentage: true,
      },
    });

    // console.log(loyaltySchemes);
  
    const schemesBySaloon = loyaltySchemes.reduce<Record<string, any[]>>(
      (acc, s) => {
      acc[s.userId] = acc[s.userId] || [];
      acc[s.userId].push(s);
      return acc;
      },
      {},
    );

    // Sort schemes for each saloon by descending pointThreshold (highest first)
    Object.values(schemesBySaloon).forEach(arr =>
      arr.sort((a, b) => (b.pointThreshold ?? 0) - (a.pointThreshold ?? 0)),
    );

    // Pick the best applicable scheme per saloon based on the customer's totalPoints.
    // If the customer has no loyalty record for a saloon, or doesn't meet any threshold,
    // the mapping will contain null (meaning not eligible).
    const loyaltySchemeBySaloon: Record<string, any | null> = {};
    Object.keys(schemesBySaloon).forEach(salId => {
      const schemes = schemesBySaloon[salId];
      const loyalty = loyaltyBySaloon[salId];

      if (loyalty && Array.isArray(schemes) && schemes.length > 0) {
      // find highest threshold that the customer qualifies for
      const matched = schemes.find(
        sch => (loyalty.totalPoints ?? 0) >= (sch.pointThreshold ?? 0),
      );
      loyaltySchemeBySaloon[salId] = matched ?? null;
      } else {
      loyaltySchemeBySaloon[salId] = null;
      }
    });

    const data = pagedSaloonIds.map(sid => {
      const visit = visits.find(v => v.saloonOwnerId === sid);
      const loyalty = loyaltyBySaloon[sid];
      const scheme = loyaltySchemeBySaloon[sid];

      // get the customer's last visit record for this saloon (if any)
      const customerVisit = allVisits.find(v => v.saloonOwnerId === sid);

      // All schemes available for this saloon (may be empty)
      const schemes = schemesBySaloon[sid] ?? [];

      // Build offers array with eligibility info so customer can choose
      const offers = schemes.map((sch: any, idx: number) => {
      const threshold = Number(sch.pointThreshold ?? 0);
      const percentage = Number(sch.percentage ?? 0);
      const totalPoints = Number(loyalty?.totalPoints ?? 0);
      const eligible = totalPoints >= threshold;
      return {
        // include a local identifier in case scheme lacks an id
        schemeKey: `${sid}#${idx}`,
        pointThreshold: threshold,
        percentage,
        eligible,
        pointsNeeded: Math.max(0, threshold - totalPoints),
        // raw scheme (optional) - keep minimal to avoid leaking unrelated fields
        // raw: {
        // userId: sch.userId,
        // pointThreshold: sch.pointThreshold,
        // percentage: sch.percentage,
        // },
      };
      });

      // Only the offers customer can actually use right now
      const applicableOffers = offers.filter((o: any) => o.eligible);

      const offerEligible =
      !!(loyalty && scheme && loyalty.totalPoints >= scheme.pointThreshold);
      const offerPercentage = offerEligible ? scheme.percentage ?? 0 : 0;

      return {
      saloonOwnerId: sid,
      shopName: visit?.saloon?.shopName ?? null,
      customerName: customerVisit?.customer?.fullName ?? null,
      customerImage: customerVisit?.customer?.image ?? null,
      visitCount: visits.filter(v => v.saloonOwnerId === sid).length,
      lastVisitedAt: visit?.createdAt ?? null,
      totalPoints: loyalty?.totalPoints ?? 0,
      // legacy single best offer info (kept for compatibility)
      // offerEligible,
      // offerPercentage,
      // new arrays for customers to choose from
      offers, // all offers defined for this saloon with eligibility flags
      applicableOffers, // only offers the customer currently qualifies for
      };
    });

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getCustomerByIdFromDb = async (userId: string, customerId: string) => {
  const result = await prisma.user.findUnique({
    where: {
      id: customerId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'customer not found');
  }
  return {
    isMe: result.id === userId,
    id: result.id,
    fullName: result.fullName,
    email: result.email,
    phoneNumber: result.phoneNumber,
    image: result.image,
    address: result.address,
  };
};

const updateCustomerIntoDb = async (
  userId: string,
  customerId: string,
  data: any,
) => {
  const result = await prisma.saloonOwner.update({
    where: {
      id: customerId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'customerId, not updated');
  }
  return result;
};

const deleteCustomerItemFromDb = async (userId: string, customerId: string) => {
  const deletedItem = await prisma.saloonOwner.delete({
    where: {
      id: customerId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'customerId, not deleted');
  }

  return deletedItem;
};

export const customerService = {
  createCustomerIntoDb,
  getAllSaloonListFromDb,
  getMyNearestSaloonListFromDb,
  getTopRatedSaloonsFromDb,
  getSaloonAllServicesListFromDb,
  getCustomerByIdFromDb,
  getVisitedSaloonListFromDb,
  addSaloonToFavoritesInDb,
  getFavoriteSaloonsFromDb,
  removeSaloonFromFavoritesInDb,
  updateCustomerIntoDb,
  deleteCustomerItemFromDb,
};
