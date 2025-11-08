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
  const lastYear = new Date();
  lastYear.setFullYear(lastYear.getFullYear() - 1);

  let limit = 0;

  if (subscriptionPlan === SubscriptionPlanStatus.FREE) {
    limit = 1;
  } else if (subscriptionPlan === SubscriptionPlanStatus.BASIC_PREMIUM) {
    limit = 3;
  } else if (subscriptionPlan === SubscriptionPlanStatus.PRO_PREMIUM) {
    limit = Infinity; // no restriction
  }

  if (limit > 0) {
    const existingJobPosts = await prisma.jobPost.count({
      where: {
        userId,
        createdAt: { gte: lastYear },
        isActive: true,
      },
    });

    if (existingJobPosts >= limit) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        `${subscriptionPlan} allows only ${limit} active job post(s) per year. Please upgrade your subscription to create more job posts.`,
      );
    }
  }

  // fetch shop details
  const shopDetails = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      SaloonOwner: {
        select: {
          userId: true,
          shopLogo: true,
          shopName: true,
          shopAddress: true,
        },
      },
    },
  });

  if (!shopDetails || !shopDetails.SaloonOwner) {
    throw new AppError(httpStatus.NOT_FOUND, 'Shop not found');
  }

  return await prisma.$transaction(async tx => {
    const result = await tx.jobPost.create({
      data: {
        ...data,
        userId,
        saloonOwnerId: shopDetails.SaloonOwner[0]?.userId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        datePosted: new Date(data.datePosted),
        shopName: shopDetails.SaloonOwner[0]?.shopName,
        shopLogo: shopDetails.SaloonOwner[0]?.shopLogo,
        shopAddress: shopDetails.SaloonOwner[0]?.shopAddress,
      },
    });

    if (!result) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Job post not created');
    }

    await tx.saloonOwner.update({
      where: { userId },
      data: {
        jobPostCount: { increment: 1 },
      },
    });

    return result;
  });
};


const getJobPostListFromDb = async (
  options: ISearchAndFilterOptions,
  barberId?: string, // optional barber/user id to exclude already-applied jobs
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query
  const searchQuery = options.searchTerm
    ? {
        OR: [
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
  const whereClause: any = {
    ...filterQuery,
    ...salaryRangeQuery,
    ...dateRangeQuery,
    ...(Object.keys(searchQuery).length > 0 && searchQuery),
  };

  // Exclude job posts the barber already applied to (if barberId provided)
  // Assumes a relation field "JobApplication" on jobPost and that each application has a "userId" field.
  // Adjust field names ("JobApplication" / "userId") to match your Prisma schema if different.
  if (barberId) {
    whereClause.NOT = {
      JobApplication: {
        some: { userId: barberId },
      },
    };
  }

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
        // salary: true,
        // location: true,
        // experienceRequired: true,
        isActive: true,
        datePosted: true,
        startDate: true,
        endDate: true,
        shopName: true,
        shopLogo: true,
        shopAddress: true,
        saloonOwnerId: true,
        saloonOwner: {
          select: {
            shopAddress: true,
            ratingCount : true,
            avgRating : true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.jobPost.count({
      where: whereClause,
    }),
  ]);

  // flatten saloonOwner details into main object
  const jobPostsWithSaloonDetails = jobPosts.map(jobPost => {
    const { saloonOwner, ...rest } = jobPost;
    return {
      ...rest,
      shopAddress: saloonOwner?.shopAddress,
      saloonOwnerRatingCount: saloonOwner?.ratingCount,
      saloonOwnerAvgRating: saloonOwner?.avgRating,
    };
  });


  return formatPaginationResponse(jobPostsWithSaloonDetails, total, page, limit);
};

const getMyJobPostsListFromDb = async (userId: string, options: ISearchAndFilterOptions) => {
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
    userId: userId,
    isActive:
      options.isActive !== undefined ? options.isActive === 'true' : undefined,
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
        // salary: true,
        // location: true,
        // experienceRequired: true,
        hourlyRate: true,
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
}


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
  getMyJobPostsListFromDb,
  getJobPostByIdFromDb,
  updateJobPostIntoDb,
  toggleJobPostActiveIntoDb,
  deleteJobPostItemFromDb,
};
