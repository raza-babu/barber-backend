import prisma from '../../utils/prisma';
import { JobApplicationStatus, UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

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
  console.log('saloonDetails', saloonDetails);

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

const getJobApplicationsListFromDb = async (userId: string) => {
  const result = await prisma.jobApplication.findMany({
    where: {
      OR: [{ userId: userId }, { saloonOwnerId: userId }],
    },
  });

  if (result.length === 0) {
    return [];
  }
  return result;
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
  });
  if (!result) {
    return { message: 'Job Application not found' };
  }
  return result;
};

const getHiredBarbersListFromDb = async (userId: string) => {
  const result = await prisma.hiredBarber.findMany({
    where: {
      userId: userId,
    }
  });
  if (result.length === 0) {
    return [];
  }
  return result;
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
  if(result.status === JobApplicationStatus.COMPLETED) {
    const newHiredBarber = await prisma.hiredBarber.create({
      data: {
        userId: result.saloonOwnerId,
        barberId: result.userId,
        hourlyRate: result.jobPost.hourlyRate,
        startDate: result.jobPost.startDate,
      }
    });
    if (!newHiredBarber) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Failed to create hired barber record');
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
