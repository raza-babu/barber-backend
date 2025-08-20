import prisma from '../../utils/prisma';
import { BookingStatus, UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';


const createBarberIntoDb = async (userId: string, data: any) => {
  
    const result = await prisma.barber.create({ 
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'barber not created');
  }
    return result;
};

const getBarberDashboardFromDb = async (userId: string) => {
  const customerCount = await prisma.booking.count({
    where: {
      saloonOwnerId: userId,
      status: BookingStatus.COMPLETED,
    },
  });
  const totalEarnings = await prisma.booking.aggregate({
    _sum: {
      totalPrice: true,
    },
    where: {
      saloonOwnerId: userId,
      status: BookingStatus.COMPLETED
    },
  });
  
  const barberCount = await prisma.barber.count({
    where: {
      saloonOwnerId: userId,
    },
  });
  const bookingCount = await prisma.booking.count({
    where: {
      saloonOwnerId: userId,
      status: BookingStatus.PENDING,
    },
  });
  const customerGrowth = await prisma.booking.groupBy({
    by: ['createdAt'],
    _count: {
      id: true,
    },
    where: {
      saloonOwnerId: userId,
      status: BookingStatus.COMPLETED,
      createdAt: {
        gte: new Date(new Date().setMonth(new Date().getMonth() - 1)), // Last month
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // Group customer growth by month
  const monthlyGrowth: { [key: string]: number } = {};
  customerGrowth.forEach(item => {
    const month = `${item.createdAt.getFullYear()}-${String(item.createdAt.getMonth() + 1).padStart(2, '0')}`;
    monthlyGrowth[month] = (monthlyGrowth[month] || 0) + item._count.id;
  });

  return {
    totalCustomers: customerCount,
    totalEarnings: totalEarnings._sum.totalPrice || 0,
    totalBarbers: barberCount,
    totalBookings: bookingCount,
    customerGrowth: Object.entries(monthlyGrowth).map(([month, count]) => ({
      month,
      count,
    })),
  };
};


const getCustomerBookingsFromDb = async (userId: string) => {
  const result = await prisma.booking.findMany({
    where: {
      saloonOwnerId: userId,
      status: BookingStatus.COMPLETED,
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          image: true,
        },
      },
      barber: {
        select: {
        user: { 
          select: {
            id: true,
            fullName: true,
            image: true, 
          }
        }
      },
    },
      
      BookedServices: {
        select: {
          service: {
            select: {
              id: true,
              serviceName: true,
              price: true,
        },
      },
    }
  }
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  if (result.length === 0) {
    return [];
  }
  return result;
};
const getBarberListFromDb = async (userId: string) => {
  
    const result = await prisma.barber.findMany();
    if (result.length === 0) {
    return { message: 'No barber found' };
  }
    return result;
};

const getBarberByIdFromDb = async (userId: string, barberId: string) => {
  
    const result = await prisma.barber.findUnique({ 
    where: {
      id: barberId,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'barber not found');
  }
    return result;
  };



const updateBarberIntoDb = async (userId: string, barberId: string, data: any) => {
  
    const result = await prisma.barber.update({
      where:  {
        id: barberId,
        userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'barberId, not updated');
  }
    return result;
  };

const deleteBarberItemFromDb = async (userId: string, barberId: string) => {
    const deletedItem = await prisma.barber.delete({
      where: {
      id: barberId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'barberId, not deleted');
  }

    return deletedItem;
  };

export const barberService = {
createBarberIntoDb,
getBarberDashboardFromDb,
getCustomerBookingsFromDb,
getBarberListFromDb,
getBarberByIdFromDb,
updateBarberIntoDb,
deleteBarberItemFromDb,
};