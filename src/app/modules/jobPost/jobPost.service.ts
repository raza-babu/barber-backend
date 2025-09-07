import prisma from '../../utils/prisma';
import {
  SubscriptionPlanStatus,
  UserRoleEnum,
  UserStatus,
} from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import {
  calculatePagination,
  formatPaginationResponse,
} from '../../utils/pagination';
import {
  buildCompleteQuery,
  buildNumericRangeQuery,
} from '../../utils/searchFilter';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const createJobPostIntoDb = async (
  userId: string,
  subscriptionPlan: string,
  data: any,
) => {
  // Free plan allows only 1 active job post per year. Please upgrade your subscription to create more job posts.
  if (subscriptionPlan === SubscriptionPlanStatus.FREE) {
    const existingJobPosts = await prisma.jobPost.findMany({
      where: {
        userId: userId,
        createdAt: {
          gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
        },
        isActive: true,
      },
    });

    if (existingJobPosts.length >= 1) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Free plan allows only 1 active job post per year. Please upgrade your subscription to create more job posts.',
      );
    }
  } else if (subscriptionPlan === SubscriptionPlanStatus.BASIC_PREMIUM) {
    // Basic plan allows only 3 active job posts per year. Please upgrade your subscription to create more job posts.
    const existingJobPosts = await prisma.jobPost.findMany({
      where: {
        userId: userId,
        createdAt: {
          gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
        },
        isActive: true,
      },
    });

    if (existingJobPosts.length >= 3) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Basic plan allows only 3 active job posts per year. Please upgrade your subscription to create more job posts.',
      );
    }


    // If the plan is PRO_PREMIUM no restrictions apply
  }
  
  if (subscriptionPlan === SubscriptionPlanStatus.PRO_PREMIUM ||
    subscriptionPlan === SubscriptionPlanStatus.BASIC_PREMIUM) {
    // No restrictions
    const shopDetails = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        SaloonOwner: {
          select: {
            userId: true,
            shopLogo: true,
            shopName: true,
          },
        },
      },
    });
    if (!shopDetails) {
      throw new AppError(httpStatus.NOT_FOUND, 'Shop not found');
    }
  

    return await prisma.$transaction(async tx => {
      const result = await tx.jobPost.create({
        data: {
          ...data,
          userId: userId,
          saloonOwnerId: shopDetails.SaloonOwner[0]?.userId as string,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          datePosted: new Date(data.datePosted),
          shopName: shopDetails.SaloonOwner[0]?.shopName as string,
          shopLogo: shopDetails.SaloonOwner[0]?.shopLogo as string,
        },
      });
      if (!result) {
        throw new AppError(httpStatus.BAD_REQUEST, 'jobPost not created');
      }

      await tx.saloonOwner.update({
        where: {
          userId: userId,
        },
        data: {
          jobPostCount: {
            increment: 1,
          },
        }
      
      });
    

      
      return result;
    
    });
  
  
  }
};



const getJobPostListFromDb = async (options: ISearchAndFilterOptions) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query
  const searchQuery = options.searchTerm
    ? {
        OR: [
          {
            // title: {
            //   contains: options.searchTerm,
            //   mode: 'insensitive' as const,
            // },
          },
          {
            description: {
              contains: options.searchTerm,
              mode: 'insensitive' as const,
            },
          },
          {
            shopName: {
              contains: options.searchTerm,
              mode: 'insensitive' as const,
            },
          },
          {
            location: {
              contains: options.searchTerm,
              mode: 'insensitive' as const,
            },
          },
        ],
      }
    : {};

  // Build filter query
  const filterQuery: any = {
    isActive:
      options.isActive !== undefined ? options.isActive === 'true' : true,
  };

  // Add experience filter if provided
  if (options.experienceRequired !== undefined) {
    filterQuery.experienceRequired = {
      gte: Number(options.experienceRequired),
    };
  }

  // Build salary range filter
  const salaryRangeQuery = buildNumericRangeQuery(
    'salary',
    options.salaryMin ? Number(options.salaryMin) : undefined,
    options.salaryMax ? Number(options.salaryMax) : undefined,
  );

  // Build date range query
  const dateRangeQuery =
    options.startDate || options.endDate
      ? {
          datePosted: {
            ...(options.startDate && { gte: new Date(options.startDate) }),
            ...(options.endDate && { lte: new Date(options.endDate) }),
          },
        }
      : {};

  // Combine all queries
  const whereClause = {
    ...filterQuery,
    ...salaryRangeQuery,
    ...dateRangeQuery,
    ...(Object.keys(searchQuery).length > 0 && searchQuery),
  };

  const [jobPosts, total] = await Promise.all([
    prisma.jobPost.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      select: {
        id: true,
        // title: true,
        description: true,
        salary: true,
        // location: true,
        // experienceRequired: true,
        isActive: true,
        datePosted: true,
        startDate: true,
        endDate: true,
        shopName: true,
        shopLogo: true,
        saloonOwnerId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.jobPost.count({
      where: whereClause,
    }),
  ]);

  return formatPaginationResponse(jobPosts, total, page, limit);
};

const getJobPostByIdFromDb = async (userId: string, jobPostId: string) => {
  const result = await prisma.jobPost.findUnique({
    where: {
      id: jobPostId,
      userId: userId,
      isActive: true,
    },
  });
  if (!result) {
    return { message: 'No job post found' };
  }
  return result;
};

const updateJobPostIntoDb = async (
  userId: string,
  jobPostId: string,
  data: any,
) => {
  const updateData: any = {
    ...data,
    userId: userId,
  };

  if (data.startDate) {
    updateData.startDate = new Date(data.startDate);
  }
  if (data.endDate) {
    updateData.endDate = new Date(data.endDate);
  }

  const result = await prisma.jobPost.update({
    where: {
      id: jobPostId,
      userId: userId,
    },
    data: updateData,
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'jobPostId, not updated');
  }
  return result;
};

const toggleJobPostActiveIntoDb = async (userId: string, jobPostId: string) => {
  const jobPost = await prisma.jobPost.findUnique({
    where: {
      id: jobPostId,
      userId: userId,
    },
  });
  if (!jobPost) {
    throw new AppError(httpStatus.NOT_FOUND, 'JobPost not found');
  }
  const updatedJobPost = await prisma.jobPost.update({
    where: {
      id: jobPostId,
      userId: userId,
    },
    data: {
      isActive: !jobPost.isActive,
    },
  });
  if (!updatedJobPost) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'JobPost active status not toggled',
    );
  }
  return updatedJobPost;
};

const deleteJobPostItemFromDb = async (userId: string, jobPostId: string) => {
  console.log('Deleting Job Post ID:', jobPostId, 'for User ID:', userId);
  const deletedItem = await prisma.jobPost.delete({
    where: {
      id: jobPostId,
      saloonOwnerId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'jobPostId, not deleted');
  }
  await prisma.saloonOwner.update({
    where: {
      userId: userId,
    },
    data: {
      jobPostCount: {
        decrement: 1,
      },
    },
  });

  return deletedItem;
};

export const jobPostService = {
  createJobPostIntoDb,
  getJobPostListFromDb,
  getJobPostByIdFromDb,
  updateJobPostIntoDb,
  toggleJobPostActiveIntoDb,
  deleteJobPostItemFromDb,
};
