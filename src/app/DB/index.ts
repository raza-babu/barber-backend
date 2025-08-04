import { UserRoleEnum, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import config from '../../config';
import prisma from '../utils/prisma';

const superAdminData = {
  fullName: 'Super Admin',
  email: 'admin@gmail.com',
  password: '',
  role: UserRoleEnum.SUPER_ADMIN,
  status: UserStatus.ACTIVE,
};

const seedSuperAdmin = async () => {
  try {
    // Check if a super admin already exists
    const isSuperAdminExists = await prisma.user.findFirst({
      where: {
        role: UserRoleEnum.SUPER_ADMIN,
      },
    });

    // If not, create one
    if (!isSuperAdminExists) {
      superAdminData.password = await bcrypt.hash(
        config.super_admin_password as string,
        Number(config.bcrypt_salt_rounds) || 12,
      );
      await prisma.user.create({
        data: superAdminData,
      });
      console.log('Super Admin created successfully.');
    } else {
      return;
      //   console.log("Super Admin already exists.");
    }
  } catch (error) {
    console.error('Error seeding Super Admin:', error);
  }
};

export default seedSuperAdmin;
