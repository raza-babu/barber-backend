import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { start } from 'repl';

const createJobPostIntoDb = async (userId: string, data: any) => {
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

  const result = await prisma.jobPost.create({
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
  return result;
};

const getJobPostListFromDb = async () => {
  const result = await prisma.jobPost.findMany({
    where: {
      isActive: true,
    },
  });
  if (result.length === 0) {
    return [];
  }
  return result;
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
    return { message: "No job post found" }
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
  const deletedItem = await prisma.jobPost.delete({
    where: {
      id: jobPostId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'jobPostId, not deleted');
  }

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
