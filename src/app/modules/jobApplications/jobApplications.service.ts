import prisma from '../../utils/prisma';
import { JobApplicationStatus, UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { calculatePagination, formatPaginationResponse } from '../../utils/pagination';
import { buildCompleteQuery } from '../../utils/searchFilter';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const createJobApplicationsIntoDb = async (userId: string, data: any) => {
  const saloonDetails = await prisma.jobPost.findUnique({
    where: {
      id: data.jobPostId,
    },
    select: {
      saloonOwnerId: true,
    },
  });
  if (!saloonDetails) {
    throw new AppError(httpStatus.NOT_FOUND, 'Saloon not found');
  }

  const result = await prisma.jobApplication.create({
    data: {
      ...data,
      userId: userId,
      saloonOwnerId: saloonDetails.saloonOwnerId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'jobApplications not created');
  }
  return result;
};

const getJobApplicationsListFromDb = async (userId: string, options: ISearchAndFilterOptions) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);
  
  // Build base where clause for user access
  const baseWhereClause = {
    OR: [{ userId: userId }, { saloonOwnerId: userId }],
  };

  // Build search and filter queries
  const searchAndFilterQuery = buildCompleteQuery(
    {
      searchTerm: options.searchTerm,
      searchFields: ['barber.user.fullName', 'barber.user.email', 'jobPost.description'],
    },
    {
      status: options.status,
      jobPostId: options.jobPostId,
    },
    {
      startDate: options.startDate,
      endDate: options.endDate,
      dateField: 'createdAt',
    }
  );

  // Since Prisma doesn't handle nested search well, we'll handle it manually
  let whereClause: any = { ...baseWhereClause };

  // Add simple filters
  if (options.status) {
    whereClause.status = options.status;
  }
  if (options.jobPostId) {
    whereClause.jobPostId = options.jobPostId;
  }

  // Add date range filter
  if (options.startDate || options.endDate) {
    whereClause.createdAt = {};
    if (options.startDate) {
      whereClause.createdAt.gte = new Date(options.startDate);
    }
    if (options.endDate) {
      whereClause.createdAt.lte = new Date(options.endDate);
    }
  }

  // Handle search across related fields
  if (options.searchTerm) {
    whereClause.OR = [
      ...whereClause.OR,
      {
        barber: {
          user: {
            fullName: {
              contains: options.searchTerm,
              mode: 'insensitive' as const,
            },
          },
        },
      },
      {
        barber: {
          user: {
            email: {
              contains: options.searchTerm,
              mode: 'insensitive' as const,
            },
          },
        },
      },
      {
        jobPost: {
          description: {
            contains: options.searchTerm,
            mode: 'insensitive' as const,
          },
        },
      },
    ];
  }

  const [jobApplications, total] = await Promise.all([
    prisma.jobApplication.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        barber: {
          select: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
                image: true,
              },
            },
          },
        },
        jobPost: {
          select: {
            id: true,
            // title: true,
            description: true,
            hourlyRate: true,
            startDate: true,
            endDate: true,
            datePosted: true,
            shopName: true,
          },
        },
      },
    }),
    prisma.jobApplication.count({
      where: whereClause,
    }),
  ]);

  // Transform the data
  const transformedData = jobApplications.map(app => ({
    id: app.id,
    status: app.status,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
    barber: app.barber?.user,
    jobPost: app.jobPost,
  }));

  return formatPaginationResponse(transformedData, total, page, limit);
};

const getJobApplicationsByIdFromDb = async (
  userId: string,
  jobApplicationsId: string,
) => {
  const result = await prisma.jobApplication.findUnique({
    where: {
      id: jobApplicationsId,
      OR: [{ userId: userId }, { saloonOwnerId: userId }],
    },
    include: {
      barber: {
        select: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phoneNumber: true,
              image: true,
            },
          },
        },
      },
      jobPost: {
        select: {
          id: true,
          // title: true,
          description: true,
          hourlyRate: true,
          startDate: true,
          endDate: true,
          datePosted: true,
          shopName: true,
        },
      },
    },
  });
  if (!result) {
    return {message: 'Job application not found'  };
  }
  return {
    id: result.id,
    status: result.status,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    barber: result.barber?.user,
    jobPost: result.jobPost,
  };
};

const getHiredBarbersListFromDb = async (userId: string, options: ISearchAndFilterOptions) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);
  
  // Build where clause
  let whereClause: any = {
    userId: userId,
  };

  // Add date range filter
  if (options.startDate || options.endDate) {
    whereClause.createdAt = {};
    if (options.startDate) {
      whereClause.createdAt.gte = new Date(options.startDate);
    }
    if (options.endDate) {
      whereClause.createdAt.lte = new Date(options.endDate);
    }
  }

  // Handle search across barber fields
  if (options.searchTerm) {
    whereClause.barber = {
      user: {
        OR: [
          {
            fullName: {
              contains: options.searchTerm,
              mode: 'insensitive' as const,
            },
          },
          {
            email: {
              contains: options.searchTerm,
              mode: 'insensitive' as const,
            },
          },
          {
            phoneNumber: {
              contains: options.searchTerm,
              mode: 'insensitive' as const,
            },
          },
        ],
      },
    };
  }

  const [hiredBarbers, total] = await Promise.all([
    prisma.hiredBarber.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        barber: {
          select: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
                image: true,
              },
            },
          },
        },
      },
    }),
    prisma.hiredBarber.count({
      where: whereClause,
    }),
  ]);

  // Transform the data
  const transformedData = hiredBarbers.map(hired => ({
    id: hired.id,
    hourlyRate: hired.hourlyRate,
    startDate: hired.startDate,
    createdAt: hired.createdAt,
    updatedAt: hired.updatedAt,
    barberId: hired.barber?.user?.id,
    barberFullName: hired.barber?.user?.fullName,
    barberEmail: hired.barber?.user?.email,
    barberPhoneNumber: hired.barber?.user?.phoneNumber,
    barberImage: hired.barber?.user?.image,
  }));

  return formatPaginationResponse(transformedData, total, page, limit);
};

const updateJobApplicationsIntoDb = async (
  userId: string,
  jobApplicationsId: string,
  data: any,
) => {
  const result = await prisma.jobApplication.update({
    where: {
      id: jobApplicationsId,
      saloonOwnerId: userId,
    },
    data: {
      ...data,
    },
    include: {
      jobPost: {
        select: {
          id: true,
          description: true,
          saloonOwnerId: true,
          hourlyRate: true,
          startDate: true,
          endDate: true,
          datePosted: true,
        },
      },
    },
  });
  if (!result) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'jobApplicationsId, not updated',
    );
  }
  if (result.status === JobApplicationStatus.COMPLETED) {
    const newHiredBarber = await prisma.hiredBarber.create({
      data: {
        userId: result.saloonOwnerId,
        barberId: result.userId,
        hourlyRate: result.jobPost.hourlyRate,
        startDate: result.jobPost.startDate,
      },
    });
    if (!newHiredBarber) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Failed to create hired barber record',
      );
    }
  }

  return result;
};

const deleteJobApplicationsItemFromDb = async (
  userId: string,
  jobApplicationsId: string,
) => {
  const deletedItem = await prisma.jobApplication.delete({
    where: {
      id: jobApplicationsId,
      OR: [{ userId: userId }, { saloonOwnerId: userId }],
    },
  });
  if (!deletedItem) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'jobApplicationsId, not deleted',
    );
  }

  return deletedItem;
};

export const jobApplicationsService = {
  createJobApplicationsIntoDb,
  getJobApplicationsListFromDb,
  getJobApplicationsByIdFromDb,
  getHiredBarbersListFromDb,
  updateJobApplicationsIntoDb,
  deleteJobApplicationsItemFromDb,
};