import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { customerService } from '../customer/customer.service';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const createAskReyIntoDb = async (
  
     userId: string,
  file: Express.Multer.File,
  body: {
    imageDescription?: string;
    latitude?: number;
    longitude?: number;
  },
) => {
  if (!file) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Image file is required');
  }

  if (!body.latitude || !body.longitude) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Latitude and longitude are required',
    );
  }

  const { latitude, longitude } = body;

  // Step 1: Get nearest 15 saloons within 10 KM radius
  console.log('=== Step 1: Getting Nearest Saloons ===');
  const nearestSaloons = await customerService.getMyNearestSaloonListFromDb(
    userId,
    latitude,
    longitude,
    {
      radius: 15, // 10 KM radius
      limit: 10, // Get first 10
      page: 1,
    },
  );

  console.log(`Found ${nearestSaloons.data.length} saloons within 10 KM`);

  if (nearestSaloons.data.length === 0) {
    return {
      success: true,
      message: 'No saloons found within 10 KM radius',
      nearestSaloons: [],
      matchedBarbers: [],
      recommendations: [],
    };
  }

  // Step 2: Extract all barber userIds from these saloons
  console.log('=== Step 2: Extracting Barber IDs ===');
  const allBarberIds: string[] = [];
  const saloonBarberMap = new Map<string, any[]>(); // Map saloonId -> barbers

  nearestSaloons.data.forEach(saloon => {
    const barbers = saloon.availableBarbers || [];
    barbers.forEach((barber: any) => {
      if (barber.barberId) {
        allBarberIds.push(barber.barberId);
      }
    });
    saloonBarberMap.set(saloon.userId, barbers);
  });

  const uniqueBarberIds = [...new Set(allBarberIds)];
  console.log(`Total unique barbers: ${uniqueBarberIds.length}`);

  if (uniqueBarberIds.length === 0) {
    return {
      success: true,
      message: 'No available barbers found in nearby saloons',
      nearestSaloons: nearestSaloons.data,
      matchedBarbers: [],
      recommendations: [],
    };
  }

  // Step 3: Get all barbers from AI model
  console.log('=== Step 3: Fetching Barbers from AI Model ===');
  let aiBarbers: any[] = [];
  try {
    const getBarberResp = await axios.get(
      'https://reyai.dsrt321.online/get_barbers',
      {
        timeout: 30000,
      },
    );

    console.log('AI Barbers Response:', {
      success: getBarberResp.data?.success,
      total: getBarberResp.data?.total_barbers,
    });

    if (
      getBarberResp.data?.success &&
      Array.isArray(getBarberResp.data.barbers)
    ) {
      aiBarbers = getBarberResp.data.barbers;
    }
  } catch (err: any) {
    console.error('Failed to fetch barbers from AI model:', err.message);
    // Continue without AI barbers
  }

  // Step 4: Match barber codes from AI with our database barbers
  console.log('=== Step 4: Matching Barbers ===');
  const aiBarberCodes = aiBarbers.map((b: any) => b.barber_code);
  const matchedBarberIds = uniqueBarberIds.filter(id =>
    aiBarberCodes.includes(id),
  );

  console.log(
    `Matched barbers: ${matchedBarberIds.length} out of ${uniqueBarberIds.length}`,
  );

  if (matchedBarberIds.length === 0) {
    return {
      success: true,
      message: 'No barbers with portfolio images found in nearby saloons',
      nearestSaloons: nearestSaloons.data,
      matchedBarbers: [],
      recommendations: [],
    };
  }

  // Step 5: Send customer image to AI for analysis
  console.log('=== Step 5: Analyzing Customer Image ===');
  const form = new FormData();

  // Add image
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

    const fileBuffer = fs.readFileSync(resolvedPath);
    form.append('image', fileBuffer, {
      filename: file.originalname || path.basename(resolvedPath),
      contentType: file.mimetype || 'image/jpeg',
    });

    // Cleanup temp file
    try {
      fs.unlinkSync(resolvedPath);
    } catch (cleanupErr) {
      console.error('Failed to cleanup temp file:', cleanupErr);
    }
  } else {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Unsupported file format. Please upload a valid image.',
    );
  }

  // Add matched barber codes to the request
  matchedBarberIds.forEach(barberId => {
    form.append('barber_code', barberId);
  });

  console.log(`Sending ${matchedBarberIds.length} barber codes to AI model`);
  console.log(`Form data headers: ${JSON.stringify(form.getHeaders())}`);

  try {
    const analyzeUrl = 'https://reyai.dsrt321.online/analyze';
    const headers = form.getHeaders();

    console.log('Sending to AI analysis with barber codes:', matchedBarberIds);

    const analyzeResp = await axios.post(analyzeUrl, form, {
      headers,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 60000,
      validateStatus: status => status < 500,
    });

    console.log('=== AI Analysis Response ===');
    console.log('Status:', analyzeResp.status);
    console.log('Success:', analyzeResp.data?.success);

    // Handle errors
    if (analyzeResp.status === 400) {
      const errorMessage =
        analyzeResp.data?.message ||
        analyzeResp.data?.error ||
        'Bad request to AI service';
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `AI service error: ${errorMessage}`,
      );
    }

    if (analyzeResp.status >= 400) {
      throw new AppError(
        httpStatus.BAD_GATEWAY,
        `AI service returned error: ${analyzeResp.status}`,
      );
    }

    if (!analyzeResp.data || !analyzeResp.data.success) {
      throw new AppError(
        httpStatus.BAD_GATEWAY,
        'AI analysis failed. Please try again.',
      );
    }

    // Step 6: Process AI recommendations
    console.log('=== Step 6: Processing Recommendations ===');
    const {
      barber_code: recommendedBarberCode,
      input_description,
      matches = [],
    } = analyzeResp.data;

    // Get detailed barber and saloon information from database
    const barberDetails = await prisma.barber.findMany({
      where: {
        userId: { in: matchedBarberIds },
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

    // Create a map for quick lookup
    const barberMap = new Map(barberDetails.map(b => [b.userId, b]));

    // Calculate distance for each barber's saloon
    const calculateDistance = (
      lat1: number,
      lon1: number,
      lat2: number,
      lon2: number,
    ): number => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.round(R * c * 100) / 100;
    };

    // Get recommended barber details
    let recommendedBarber = null;
    if (recommendedBarberCode) {
      const barber = barberMap.get(recommendedBarberCode);
      if (barber && barber.saloonOwner) {
        const distance = calculateDistance(
          latitude,
          longitude,
          Number(barber.saloonOwner.latitude),
          Number(barber.saloonOwner.longitude),
        );

        recommendedBarber = {
          barberId: barber.userId,
          barberName: barber.user?.fullName || null,
          barberEmail: barber.user?.email || null,
          barberImage: barber.user?.image || null,
          barberPhone: barber.user?.phoneNumber || null,
          saloon: {
            saloonOwnerId: barber.saloonOwner.userId,
            shopName: barber.saloonOwner.shopName,
            shopAddress: barber.saloonOwner.shopAddress,
            shopLogo: barber.saloonOwner.shopLogo,
            shopImages: barber.saloonOwner.shopImages || [],
            latitude: Number(barber.saloonOwner.latitude),
            longitude: Number(barber.saloonOwner.longitude),
            distance,
            avgRating: Number(barber.saloonOwner.avgRating || 0),
            ratingCount: barber.saloonOwner.ratingCount || 0,
          },
          matches: matches.map((m: any) => ({
            image: m.image,
            description: m.description,
            reason: m.reason,
            similarity: m.similarity || 0,
          })),
        };
      }
    }

    // Build list of all matched barbers with their saloon info and distance
    const matchedBarbersWithDetails = matchedBarberIds
      .map(barberId => {
        const barber = barberMap.get(barberId);
        if (!barber || !barber.saloonOwner) return null;

        const distance = calculateDistance(
          latitude,
          longitude,
          Number(barber.saloonOwner.latitude),
          Number(barber.saloonOwner.longitude),
        );

        // Get AI portfolio info
        const aiBarber = aiBarbers.find(
          (ab: any) => ab.barber_code === barberId,
        );

        return {
          barberId: barber.userId,
          barberName: barber.user?.fullName || null,
          barberImage: barber.user?.image || null,
          portfolioImageCount: aiBarber?.image_count || 0,
          saloon: {
            saloonOwnerId: barber.saloonOwner.userId,
            shopName: barber.saloonOwner.shopName,
            shopAddress: barber.saloonOwner.shopAddress,
            shopLogo: barber.saloonOwner.shopLogo,
            latitude: Number(barber.saloonOwner.latitude),
            longitude: Number(barber.saloonOwner.longitude),
            distance,
            avgRating: Number(barber.saloonOwner.avgRating || 0),
            ratingCount: barber.saloonOwner.ratingCount || 0,
          },
          isRecommended: barberId === recommendedBarberCode,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.saloon.distance - b.saloon.distance); // Sort by distance

    return {
      success: true,
      inputDescription: input_description || null,
      recommendedBarber,
      matchedBarbers: matchedBarbersWithDetails,
      // nearestSaloons: nearestSaloons.data.slice(0, 10), // Return top 10 nearest
      totalMatchedBarbers: matchedBarbersWithDetails.length,
      // totalNearbySaloons: nearestSaloons.data.length,
    };
  } catch (err: any) {
    console.error('=== AI Analysis Error ===');
    console.error('Error type:', err.constructor.name);
    console.error('Error message:', err.message);

    if (err.response) {
      console.error('Response status:', err.response.status);
      console.error('Response data:', err.response.data);
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

const getAskReyListFromDb = async (userId: string) => {
  
    const result = await prisma.barber.findMany();
    if (result.length === 0) {
    return { message: 'No barber found' };
  }
    return result;
};

const getAskReyByIdFromDb = async (userId: string, askReyId: string) => {
  
    const result = await prisma.barber.findUnique({ 
    where: {
      id: askReyId,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'barber not found');
  }
    return result;
  };



const updateAskReyIntoDb = async (userId: string, askReyId: string, data: any) => {
  
    const result = await prisma.barber.update({
      where:  {
        id: askReyId,
        userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'askReyId, not updated');
  }
    return result;
  };

const deleteAskReyItemFromDb = async (userId: string, askReyId: string) => {
    const deletedItem = await prisma.barber.delete({
      where: {
      id: askReyId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'askReyId, not deleted');
  }

    return deletedItem;
  };

export const askReyService = {
createAskReyIntoDb,
getAskReyListFromDb,
getAskReyByIdFromDb,
updateAskReyIntoDb,
deleteAskReyItemFromDb,
};