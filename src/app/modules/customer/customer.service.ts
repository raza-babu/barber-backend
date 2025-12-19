import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { BookingStatus, BookingType, Prisma, User } from '@prisma/client';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

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

const analyzeSaloonFromImageInDb = async (
  userId: string,
  file: Express.Multer.File,
) => {
  if (!file) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Image file is required');
  }

  const form = new FormData();

  // Handle both buffer (memoryStorage) and path (diskStorage)
  if (file.buffer && file.buffer.length > 0) {
    form.append('image', file.buffer, {
      filename: file.originalname || 'customer_image.jpg',
      contentType: file.mimetype || 'image/jpeg',
    });
  } else if (file.path) {
    const resolvedPath = path.isAbsolute(file.path)
      ? file.path
      : path.resolve(process.cwd(), file.path);

    if (!fs.existsSync(resolvedPath)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Uploaded file not found: ${resolvedPath}`,
      );
    }

    form.append('image', fs.createReadStream(resolvedPath), {
      filename: file.originalname || path.basename(resolvedPath),
      contentType: file.mimetype || 'image/jpeg',
    });
  } else {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Unsupported file format. Please upload a valid image.',
    );
  }

  try {
    // Call the third-party AI API
    const url = 'https://reyai.dsrt321.online/analyze';
    const headers = form.getHeaders();

    console.log('=== AI Analysis Request ===');
    console.log('URL:', url);
    console.log('Headers:', headers);
    console.log('File info:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      hasBuffer: !!file.buffer,
      hasPath: !!file.path,
    });

    const response = await axios.post(url, form, {
      headers,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 60000, // 60 seconds timeout
      validateStatus: status => status < 500, // Don't throw on 4xx errors
    });

    console.log('=== AI Analysis Response ===');
    console.log('Status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));

    // Handle non-success status codes
    if (response.status === 400) {
      const errorMessage =
        response.data?.message ||
        response.data?.error ||
        'Bad request to AI service';
      console.error('400 Error details:', response.data);
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `AI service error: ${errorMessage}`,
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        'Authentication failed with AI service',
      );
    }

    if (response.status === 404) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'AI analysis endpoint not found',
      );
    }

    if (response.status >= 400) {
      throw new AppError(
        httpStatus.BAD_GATEWAY,
        `AI service returned error: ${response.status}`,
      );
    }

    if (!response.data || !response.data.success) {
      throw new AppError(
        httpStatus.BAD_GATEWAY,
        'AI analysis failed. Please try again.',
      );
    }

    const {
      all_matches = [],
      best_match_per_barber = [],
      input_description,
      recommended_barber,
    } = response.data;

    // Get all unique barber codes
    const allBarberCodes = [
      ...new Set([
        ...all_matches.map((m: any) => m.barber_code),
        ...best_match_per_barber.map((m: any) => m.barber_code),
      ]),
    ].filter(Boolean);

    console.log('Extracted barber codes:', allBarberCodes);

    if (allBarberCodes.length === 0) {
      return {
        success: true,
        message: 'No matching barbers found for your style',
        input_description,
        all_matches: [],
        best_match_per_barber: [],
        recommended_barber: null,
        total_matches: 0,
      };
    }

    // Fetch barber details from database
    const barbers = await prisma.barber.findMany({
      where: {
        userId: { in: allBarberCodes },
      },
      select: {
        id: true,
        userId: true,
        saloonOwnerId: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            image: true,
            phoneNumber: true,
          },
        },
        saloonOwner: {
          select: {
            userId: true,
            shopName: true,
            shopAddress: true,
            shopLogo: true,
            shopImages: true,
            latitude: true,
            longitude: true,
            avgRating: true,
            ratingCount: true,
          },
        },
      },
    });

    console.log(`Found ${barbers.length} barbers in database`);

    // Create a map of barber details by userId
    const barberDetailsMap = new Map(
      barbers.map(barber => [
        barber.userId,
        {
          barberId: barber.id,
          barberUserId: barber.userId,
          barberName: barber.user?.fullName || null,
          barberEmail: barber.user?.email || null,
          barberImage: barber.user?.image || null,
          barberPhone: barber.user?.phoneNumber || null,
          saloon: barber.saloonOwnerId
            ? {
                saloonOwnerId: barber.saloonOwner?.userId || null,
                shopName: barber.saloonOwner?.shopName || null,
                shopAddress: barber.saloonOwner?.shopAddress || null,
                shopLogo: barber.saloonOwner?.shopLogo || null,
                shopImages: barber.saloonOwner?.shopImages || [],
                latitude: barber.saloonOwner?.latitude
                  ? Number(barber.saloonOwner.latitude)
                  : null,
                longitude: barber.saloonOwner?.longitude
                  ? Number(barber.saloonOwner.longitude)
                  : null,
                avgRating: barber.saloonOwner?.avgRating
                  ? Number(barber.saloonOwner.avgRating)
                  : 0,
                ratingCount: barber.saloonOwner?.ratingCount || 0,
              }
            : null,
        },
      ]),
    );

    // Enrich all_matches with barber details
    const enrichedAllMatches = all_matches
      .map((match: any) => {
        const barberDetails = barberDetailsMap.get(match.barber_code);
        if (!barberDetails) {
          console.log(`Barber ${match.barber_code} not found in database`);
          return null;
        }

        return {
          barber_code: match.barber_code,
          image: match.image,
          similarity: match.similarity || 0,
          ...barberDetails,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.similarity - a.similarity);

    // Enrich best_match_per_barber with barber details
    const enrichedBestMatches = best_match_per_barber
      .map((match: any) => {
        const barberDetails = barberDetailsMap.get(match.barber_code);
        if (!barberDetails) {
          console.log(`Barber ${match.barber_code} not found in database`);
          return null;
        }

        return {
          barber_code: match.barber_code,
          image: match.image,
          similarity: match.similarity || 0,
          ...barberDetails,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.similarity - a.similarity);

    // Get recommended barber details
    let recommendedBarberDetails = null;
    if (recommended_barber) {
      recommendedBarberDetails = barberDetailsMap.get(recommended_barber);
    }

    return {
      success: true,
      input_description: input_description || null,
      all_matches: enrichedAllMatches,
      best_match_per_barber: enrichedBestMatches,
      recommended_barber: recommendedBarberDetails
        ? {
            barber_code: recommended_barber,
            ...recommendedBarberDetails,
          }
        : null,
      total_matches: enrichedAllMatches.length,
    };
  } catch (err: any) {
    console.error('=== AI Analysis Error ===');
    console.error('Error type:', err.constructor.name);
    console.error('Error message:', err.message);

    if (err.response) {
      console.error('Response status:', err.response.status);
      console.error('Response data:', err.response.data);
      console.error('Response headers:', err.response.headers);
    }

    if (err.request) {
      console.error('Request was made but no response received');
    }

    if (err instanceof AppError) {
      throw err;
    }

    const message =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.message ||
      'Failed to analyze image. Please try again.';

    throw new AppError(httpStatus.BAD_GATEWAY, message);
  }
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

  // Get all saloons
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
          date: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
          status: {
            in: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
          },
        },
        select: {
          id: true,
          barberId: true,
        },
      },
      user: {
        select: {
          phoneNumber: true,
          email: true,
          HiredBarber: {
            select: {
              barberId: true,
              barber: {
                select: {
                  userId: true,
                  user: {
                    select: {
                      id: true,
                      fullName: true,
                      image: true,
                    },
                  },
                  Booking: {
                    where: {
                      bookingType: BookingType.QUEUE,
                      date: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0)),
                        lt: new Date(new Date().setHours(23, 59, 59, 999)),
                      },
                      status: {
                        in: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
                      },
                    },
                    select: {
                      id: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      FavoriteShop: { select: { id: true, userId: true } },
    },
    orderBy,
  });

  // Process saloons with shop status and barber availability
  const processedSaloons = await Promise.all(
    allSaloons.map(async saloon => {
      // Check if user favorited this shop
      const isFavorite = userId
        ? saloon.FavoriteShop.some(fav => fav.userId === userId)
        : false;

      // Check shop open/closed status using models
      const shopStatus = await checkShopStatus(saloon.userId);

      // Calculate total queue for the shop
      const totalShopQueue = Array.isArray(saloon.Booking)
        ? saloon.Booking.length
        : 0;

      // Process barbers
      const availableBarbers = await Promise.all(
        (saloon.user?.HiredBarber || []).map(async (hiredBarber: any) => {
          const barber = hiredBarber.barber;
          if (!barber) return null;

          const availability = await checkBarberAvailability(barber.userId);

          // Skip barbers not available today
          if (!availability.isAvailableToday) {
            return null;
          }

          const barberQueueCount = Array.isArray(barber.Booking)
            ? barber.Booking.length
            : 0;

          return {
            barberId: barber.userId,
            barberName: barber.user?.fullName || 'Unknown',
            barberImage: barber.user?.image || null,
            queueCount: barberQueueCount,
            availableForQueue: availability.availableForQueue,
            availableForBooking: availability.availableForBooking,
            serviceType: availability.type, // 'QUEUE' or 'BOOKING'
            workingHours: {
              openingTime: availability.openingTime || null,
              closingTime: availability.closingTime || null,
            },
          };
        }),
      );

      const filteredBarbers = availableBarbers.filter(Boolean);

      return {
        // Shop Details
        // userId: saloon.id,
        userId: saloon.userId,
        shopName: saloon.shopName,
        shopAddress: saloon.shopAddress,
        shopLogo: saloon.shopLogo,
        shopImages: saloon.shopImages || [],
        shopVideo: saloon.shopVideo || [],
        phoneNumber: saloon.user?.phoneNumber || null,
        email: saloon.user?.email || null,

        // Location
        latitude: Number(saloon.latitude),
        longitude: Number(saloon.longitude),
        distance: 0, // No distance calculation for all saloons list

        // Ratings
        avgRating: saloon.avgRating ? Number(saloon.avgRating) : 0,
        ratingCount: saloon.ratingCount || 0,

        // Status
        isOpen: shopStatus.isOpen,
        shopStatus: shopStatus.status,
        statusReason: shopStatus.reason || null,
        todayWorkingHours: {
          openingTime: shopStatus.openingTime || null,
          closingTime: shopStatus.closingTime || null,
        },

        // Queue Info
        totalQueueCount: totalShopQueue,

        // Barbers
        availableBarbers: filteredBarbers,
        totalAvailableBarbers: filteredBarbers.length,

        // User specific
        isFavorite,
      };
    }),
  );

  // Apply sorting based on sortBy parameter
  let sortedSaloons = [...processedSaloons];
  switch (sortBy) {
    case 'rating':
      sortedSaloons.sort((a, b) => b.avgRating - a.avgRating);
      break;
    case 'name':
      sortedSaloons.sort((a, b) => a.shopName.localeCompare(b.shopName));
      break;
    // 'newest' is already sorted by the query orderBy
    default:
      break;
  }

  // Apply pagination
  const total = sortedSaloons.length;
  const skip = (page - 1) * limit;
  const paginatedSaloons = sortedSaloons.slice(skip, skip + limit);
  const hasNextPage = page < total / limit;
  const hasPrevPage = page > 1;

  return {
    data: paginatedSaloons,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage,
      hasPrevPage,
    },
  };
};


// Helper function to parse time string to minutes
const timeToMinutes = (timeStr: string): number => {
  try {
    console.log('Parsing time string:', timeStr);
    
    // Format 1: "hh:mm a" or "hh:mm AM/PM" (e.g., "09:00 AM", "06:00 PM")
    const time12h = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (time12h) {
      let hours = parseInt(time12h[1], 10);
      const minutes = parseInt(time12h[2], 10);
      const meridiem = time12h[3].toUpperCase();
      
      // Convert to 24-hour format
      if (meridiem === 'PM' && hours !== 12) {
        hours += 12; // 1 PM = 13, 2 PM = 14, etc.
      } else if (meridiem === 'AM' && hours === 12) {
        hours = 0; // 12 AM = 0 (midnight)
      }
      // Note: 12 PM stays as 12 (noon)
      
      const totalMinutes = hours * 60 + minutes;
      console.log(`Parsed ${timeStr} to ${totalMinutes} minutes (${hours}:${minutes.toString().padStart(2, '0')} in 24h)`);
      return totalMinutes;
    }
    
    // Format 2: "HH:MM:SS" or "HH:MM" (e.g., "09:00:00", "18:00")
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':');
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      
      if (!isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours < 24) {
        const totalMinutes = hours * 60 + minutes;
        console.log(`Parsed ${timeStr} to ${totalMinutes} minutes (24h format)`);
        return totalMinutes;
      }
    }
    
    // Format 3: ISO time string (fallback)
    const time = new Date(`1970-01-01T${timeStr}Z`);
    if (!isNaN(time.getTime())) {
      const totalMinutes = time.getUTCHours() * 60 + time.getUTCMinutes();
      console.log(`Parsed ${timeStr} to ${totalMinutes} minutes (ISO format)`);
      return totalMinutes;
    }
    
    console.error(`Failed to parse time string: ${timeStr}`);
    return 0;
  } catch (error) {
    console.error(`Error parsing time string: ${timeStr}`, error);
    return 0;
  }
};

// Helper function to check if shop is open using SaloonSchedule and SaloonHoliday models
const checkShopStatus = async (
  saloonOwnerId: string,
): Promise<{
  isOpen: boolean;
  status: 'open' | 'closed';
  reason?: string;
  openingTime?: string;
  closingTime?: string;
}> => {
  const now = new Date();
  const today = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
  const todayDate = now.toISOString().split('T')[0];

  console.log('=== Shop Status Check ===');
  console.log('Saloon Owner ID:', saloonOwnerId);
  console.log('Today:', today, '(0=Sunday, 6=Saturday)');
  console.log('Current time minutes:', currentTimeMinutes);

  // Check if today is a holiday using SaloonHoliday model
  const todayHoliday = await prisma.saloonHoliday.findFirst({
    where: {
      userId: saloonOwnerId,
      date: {
        gte: new Date(todayDate + 'T00:00:00.000Z'),
        lt: new Date(todayDate + 'T23:59:59.999Z'),
      },
    },
  });

  if (todayHoliday) {
    console.log('Shop is closed - Holiday:', todayHoliday.holidayName);
    return {
      isOpen: false,
      status: 'closed',
      reason: todayHoliday.holidayName || 'Holiday',
    };
  }

  // Find today's schedule using SaloonSchedule model
  const todaySchedule = await prisma.saloonSchedule.findFirst({
    where: {
      saloonOwnerId: saloonOwnerId,
      dayOfWeek: today,
      isActive: true,
    },
  });

  console.log('Today Schedule:', JSON.stringify(todaySchedule, null, 2));

  if (!todaySchedule || !todaySchedule.openingTime || !todaySchedule.closingTime) {
    console.log('No schedule found for today');
    return {
      isOpen: false,
      status: 'closed',
      reason: 'No schedule for today',
    };
  }

  console.log('Opening time string:', todaySchedule.openingTime);
  console.log('Closing time string:', todaySchedule.closingTime);

  const openingMinutes = timeToMinutes(todaySchedule.openingTime);
  const closingMinutes = timeToMinutes(todaySchedule.closingTime);

  console.log(`Parsed times - Opening: ${openingMinutes}min, Closing: ${closingMinutes}min`);
  console.log(`Current time in minutes: ${currentTimeMinutes}, Opening: ${openingMinutes}, Closing: ${closingMinutes}`);

  const isOpen = currentTimeMinutes >= openingMinutes && currentTimeMinutes < closingMinutes;

  console.log(`Shop is currently ${isOpen ? 'open' : 'closed'}`);

  return {
    isOpen,
    status: isOpen ? 'open' : 'closed',
    reason: isOpen ? undefined : 'Outside operating hours',
    openingTime: todaySchedule.openingTime,
    closingTime: todaySchedule.closingTime,
  };
};

// Helper function to check barber availability using BarberSchedule model
const checkBarberAvailability = async (
  barberId: string,
): Promise<{
  isAvailableToday: boolean;
  availableForQueue: boolean;
  availableForBooking: boolean;
  type: string | null;
  openingTime?: string;
  closingTime?: string;
}> => {
  const now = new Date();
  const today = now.getDay();
  const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

  const todaySchedule = await prisma.barberSchedule.findFirst({
    where: {
      barberId: barberId,
      dayOfWeek: today,
      isActive: true,
    },
  });

  if (!todaySchedule || !todaySchedule.openingTime || !todaySchedule.closingTime) {
    return {
      isAvailableToday: false,
      availableForQueue: false,
      availableForBooking: false,
      type: null,
    };
  }

  const openingMinutes = timeToMinutes(todaySchedule.openingTime);
  const closingMinutes = timeToMinutes(todaySchedule.closingTime);

  const isWithinWorkingHours =
    currentTimeMinutes >= openingMinutes && currentTimeMinutes < closingMinutes;

  return {
    isAvailableToday: isWithinWorkingHours,
    availableForQueue: isWithinWorkingHours && todaySchedule.type === 'QUEUE',
    availableForBooking: isWithinWorkingHours && todaySchedule.type === 'BOOKING',
    type: todaySchedule.type || null,
    openingTime: todaySchedule.openingTime,
    closingTime: todaySchedule.closingTime,
  };
};

// Update the main function
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
          date: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
          status: {
            in: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
          },
        },
        select: {
          id: true,
          barberId: true,
        },
      },
      user: {
        select: {
          phoneNumber: true,
          email: true,
          HiredBarber: {
            select: {
              barberId: true,
              barber: {
                select: {
                  userId: true,
                  user: {
                    select: {
                      id: true,
                      fullName: true,
                      image: true,
                    },
                  },
                  Booking: {
                    where: {
                      bookingType: BookingType.QUEUE,
                      date: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0)),
                        lt: new Date(new Date().setHours(23, 59, 59, 999)),
                      },
                      status: {
                        in: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
                      },
                    },
                    select: {
                      id: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      FavoriteShop: { select: { id: true, userId: true } },
    },
  });

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
  const nearbySaloons = await Promise.all(
    allSaloons.map(async saloon => {
      const distance = calculateDistance(
        latitude,
        longitude,
        Number(saloon.latitude),
        Number(saloon.longitude),
      );

      // Check if user favorited this shop
      const isFavorite = userId
        ? saloon.FavoriteShop.some(fav => fav.userId === userId)
        : false;

      // Check shop open/closed status using models
      const shopStatus = await checkShopStatus(saloon.userId);

      // Calculate total queue for the shop
      const totalShopQueue = Array.isArray(saloon.Booking) ? saloon.Booking.length : 0;

      // Process barbers
      const availableBarbers = await Promise.all(
        (saloon.user?.HiredBarber || []).map(async (hiredBarber: any) => {
          const barber = hiredBarber.barber;
          if (!barber) return null;

          const availability = await checkBarberAvailability(barber.userId);

          // Skip barbers not available today
          if (!availability.isAvailableToday) {
            return null;
          }

          const barberQueueCount = Array.isArray(barber.Booking)
            ? barber.Booking.length
            : 0;

          return {
            barberId: barber.userId,
            barberName: barber.user?.fullName || 'Unknown',
            barberImage: barber.user?.image || null,
            queueCount: barberQueueCount,
            availableForQueue: availability.availableForQueue,
            availableForBooking: availability.availableForBooking,
            serviceType: availability.type, // 'QUEUE' or 'BOOKING'
            workingHours: {
              openingTime: availability.openingTime || null,
              closingTime: availability.closingTime || null,
            },
          };
        }),
      );

      const filteredBarbers = availableBarbers.filter(Boolean);

      return {
        // Shop Details
        // userId: saloon.id,
        userId: saloon.userId,
        shopName: saloon.shopName,
        shopAddress: saloon.shopAddress,
        shopLogo: saloon.shopLogo,
        shopImages: saloon.shopImages || [],
        shopVideo: saloon.shopVideo || [],
        phoneNumber: saloon.user?.phoneNumber || null,
        email: saloon.user?.email || null,

        // Location
        latitude: Number(saloon.latitude),
        longitude: Number(saloon.longitude),
        distance: Math.round(distance * 100) / 100,

        // Ratings
        avgRating: saloon.avgRating ? Number(saloon.avgRating) : 0,
        ratingCount: saloon.ratingCount || 0,

        // Status
        isOpen: shopStatus.isOpen,
        shopStatus: shopStatus.status,
        statusReason: shopStatus.reason || null,
        todayWorkingHours: {
          openingTime: shopStatus.openingTime || null,
          closingTime: shopStatus.closingTime || null,
        },

        // Queue Info
        totalQueueCount: totalShopQueue,

        // Barbers
        availableBarbers: filteredBarbers,
        totalAvailableBarbers: filteredBarbers.length,

        // User specific
        isFavorite,
      };
    }),
  );

  // Filter by radius and sort
  const filteredSaloons = nearbySaloons
    .filter(saloon => saloon.distance <= radiusInKm)
    .sort((a, b) => a.distance - b.distance);

  // Apply pagination
  const total = filteredSaloons.length;
  const skip = (page - 1) * limit;
  const paginatedSaloons = filteredSaloons.slice(skip, skip + limit);
  const hasNextPage = page < total / limit;
  const hasPrevPage = page > 1;

  return {
    data: paginatedSaloons,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage,
      hasPrevPage,

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

  // Get all saloons
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
          date: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
          status: {
            in: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
          },
        },
        select: {
          id: true,
          barberId: true,
        },
      },
      user: {
        select: {
          phoneNumber: true,
          email: true,
          HiredBarber: {
            select: {
              barberId: true,
              barber: {
                select: {
                  userId: true,
                  user: {
                    select: {
                      id: true,
                      fullName: true,
                      image: true,
                    },
                  },
                  Booking: {
                    where: {
                      bookingType: BookingType.QUEUE,
                      date: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0)),
                        lt: new Date(new Date().setHours(23, 59, 59, 999)),
                      },
                      status: {
                        in: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
                      },
                    },
                    select: {
                      id: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      FavoriteShop: { select: { id: true, userId: true } },
    },
    orderBy: {
      avgRating: 'desc', // Sort by rating descending
    },
  });

  // Process saloons with shop status and barber availability
  const processedSaloons = await Promise.all(
    allSaloons.map(async saloon => {
      // Check if user favorited this shop
      const isFavorite = userId
        ? saloon.FavoriteShop.some(fav => fav.userId === userId)
        : false;

      // Check shop open/closed status using models
      const shopStatus = await checkShopStatus(saloon.userId);

      // Calculate total queue for the shop
      const totalShopQueue = Array.isArray(saloon.Booking)
        ? saloon.Booking.length
        : 0;

      // Process barbers
      const availableBarbers = await Promise.all(
        (saloon.user?.HiredBarber || []).map(async (hiredBarber: any) => {
          const barber = hiredBarber.barber;
          if (!barber) return null;

          const availability = await checkBarberAvailability(barber.userId);

          // Skip barbers not available today
          if (!availability.isAvailableToday) {
            return null;
          }

          const barberQueueCount = Array.isArray(barber.Booking)
            ? barber.Booking.length
            : 0;

          return {
            barberId: barber.userId,
            barberName: barber.user?.fullName || 'Unknown',
            barberImage: barber.user?.image || null,
            queueCount: barberQueueCount,
            availableForQueue: availability.availableForQueue,
            availableForBooking: availability.availableForBooking,
            serviceType: availability.type, // 'QUEUE' or 'BOOKING'
            workingHours: {
              openingTime: availability.openingTime || null,
              closingTime: availability.closingTime || null,
            },
          };
        }),
      );

      const filteredBarbers = availableBarbers.filter(Boolean);

      return {
        // Shop Details
        // shopId: saloon.id,
        userId: saloon.userId,
        shopName: saloon.shopName,
        shopAddress: saloon.shopAddress,
        shopLogo: saloon.shopLogo,
        shopImages: saloon.shopImages || [],
        shopVideo: saloon.shopVideo || [],
        phoneNumber: saloon.user?.phoneNumber || null,
        email: saloon.user?.email || null,

        // Location
        latitude: Number(saloon.latitude),
        longitude: Number(saloon.longitude),
        distance: 0, // No distance calculation for top-rated

        // Ratings
        avgRating: saloon.avgRating ? Number(saloon.avgRating) : 0,
        ratingCount: saloon.ratingCount || 0,

        // Status
        isOpen: shopStatus.isOpen,
        shopStatus: shopStatus.status,
        statusReason: shopStatus.reason || null,
        todayWorkingHours: {
          openingTime: shopStatus.openingTime || null,
          closingTime: shopStatus.closingTime || null,
        },

        // Queue Info
        totalQueueCount: totalShopQueue,

        // Barbers
        availableBarbers: filteredBarbers,
        totalAvailableBarbers: filteredBarbers.length,

        // User specific
        isFavorite,
      };
    }),
  );

  // Sort by avgRating descending (already sorted in query, but ensure it)
  const sortedSaloons = processedSaloons.sort(
    (a, b) => b.avgRating - a.avgRating,
  );

  // Apply pagination
  const total = sortedSaloons.length;
  const skip = (page - 1) * limit;
  const paginatedSaloons = sortedSaloons.slice(skip, skip + limit);
  const hasNextPage = page < total / limit;
  const hasPrevPage = page > 1;

  return {
    data: paginatedSaloons,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage,
      hasPrevPage,
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

    const offerEligible = !!(
      loyalty &&
      scheme &&
      loyalty.totalPoints >= scheme.pointThreshold
    );
    const offerPercentage = offerEligible ? (scheme.percentage ?? 0) : 0;

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

const getMyLoyaltyOffersFromDb = async (
  userId: string,
  saloonOwnerId: string,
) => {
  // Get all loyalty applicable offers available from a saloon for me as a customer
  const existingPoints = await prisma.customerLoyalty.findMany({
    where: {
      userId,
      saloonOwnerId,
    },
    select: {
      totalPoints: true,
    },
  });
  // sum up total points
  let totalPoints = existingPoints.reduce(
    (sum, rec) => sum + (rec.totalPoints || 0),
    0,
  );

  const loyaltySchemes = await prisma.loyaltyScheme.findMany({
    where: {
      userId: saloonOwnerId,
    },
    select: {
      id: true,
      pointThreshold: true,
      percentage: true,
    },
    orderBy: {
      pointThreshold: 'desc',
    },
  });

  // Build offers array with eligibility info
  const offers = loyaltySchemes
    .filter(sch => {
      const threshold = Number(sch.pointThreshold ?? 0);
      return totalPoints >= threshold;
    })
    .map(sch => {
      const threshold = Number(sch.pointThreshold ?? 0);
      const percentage = Number(sch.percentage ?? 0);
      const eligible = true;
      return {
        id: sch.id,
        pointThreshold: threshold,
        percentage,
        eligible,
        pointsNeeded: 0,
      };
    });

  // filter with availed offers already to include only those not yet availed
  const availedOffers = await prisma.loyaltyRedemption.findMany({
    where: {
      customerId: userId,
      LoyaltyScheme: {
        userId: saloonOwnerId,
      },
    },
    select: {
      LoyaltyScheme: {
        select: {
          id: true,
          pointThreshold: true,
          percentage: true,
        },
      },
    },
  });

  const totalPointsUsed = await prisma.loyaltyRedemption.aggregate({
    where: {
      customerId: userId,
      LoyaltyScheme: {
        userId: saloonOwnerId,
      },
    },
    _sum: {
      pointsUsed: true,
    },
  });

  const usedPoints = totalPointsUsed._sum.pointsUsed || 0;

  totalPoints = totalPoints - usedPoints;

  const availedSet = new Set(
    availedOffers.map(
      ao =>
        `${ao.LoyaltyScheme.id}#${ao.LoyaltyScheme.pointThreshold}#${ao.LoyaltyScheme.percentage}`,
    ),
  );

  const filteredOffers = offers.filter(offer => {
    const key = `${offer.id}#${offer.pointThreshold}#${offer.percentage}`;
    return !availedSet.has(key);
  });

  return {
    totalPoints,
    filteredOffers,
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

  // check following or not
  const isFollowing = await prisma.follow.findFirst({
    where: {
      userId: userId,
      followingId: customerId,
    },
  });
  return {
    isMe: result.id === userId,
    id: result.id,
    fullName: result.fullName,
    email: result.email,
    phoneNumber: result.phoneNumber,
    image: result.image,
    address: result.address,
    isFollowing: isFollowing ? true : false,
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
  analyzeSaloonFromImageInDb,
  getAllSaloonListFromDb,
  getMyNearestSaloonListFromDb,
  getTopRatedSaloonsFromDb,
  getSaloonAllServicesListFromDb,
  getCustomerByIdFromDb,
  getVisitedSaloonListFromDb,
  getMyLoyaltyOffersFromDb,
  addSaloonToFavoritesInDb,
  getFavoriteSaloonsFromDb,
  removeSaloonFromFavoritesInDb,
  updateCustomerIntoDb,
  deleteCustomerItemFromDb,
};
