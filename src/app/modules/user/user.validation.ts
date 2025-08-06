import z from 'zod';
const registerUser = z.object({
  body: z.object({
    fullName: z.string({
      required_error: 'Name is required!',
    }),
    email: z
      .string({
        required_error: 'Email is required!',
      })
      .email({
        message: 'Invalid email format!',
      }),
    password: z.string({
      required_error: 'Password is required!',
    }),
    intendedRole: z
      .enum(['CUSTOMER', 'SALOON_OWNER', 'BARBER'], {
        required_error: 'Role is required!',
      })
      .optional(),
  }),
});

const updateProfileSchema = z.object({
  body: z.object({
    fullName: z
      .string({
        required_error: 'Name is required!',
      })
      .optional(),
    gender: z
      .string({
        required_error: 'Password is required!',
      })
      .optional(),
    phoneNumber: z
      .string({
        required_error: 'Phone number is required!',
      })
      .optional(),
  }),
    dateOfBirth: z
      .string({
        required_error: 'Date of birth is required!',
      })
      .optional(),
});

const updatePasswordSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: 'Email is required!',
      })
      .email({
        message: 'Invalid email format!',
      }),
    password: z.string({
      required_error: 'Password is required!',
    }),
  }),
});

const forgetPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: 'Email is required!',
      })
      .email({
        message: 'Invalid email format!',
      }),
  }),
});

const changePasswordSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: 'Email is required!',
      })
      .email({
        message: 'Invalid email format!',
      }),
    newPassword: z.string({
      required_error: 'Password is required!',
    }),
  }),
});

const verifyOtpSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: 'Email is required!',
      })
      .email({
        message: 'Invalid email format!',
      }),
    otp: z.number({
      required_error: 'OTP is required!',
    }),
  }),
});

const socialLoginSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: 'Email is required!',
      })
      .email({
        message: 'Invalid email format!',
      })
      .optional(),
    fullName: z.string({
      required_error: 'name is required!',
    }),
    fcmToken: z.string({
      required_error: 'Fcm token is required!',
    }),
    role: z.string({
      required_error: 'Role is required!',
    }),
  }),
});


const createSaloonOwner = z.object({
  body: z.object({
    shopName: z.string({
      required_error: 'Shop name is required!',
    }),

    registrationNumber: z.string({
      required_error: 'Registration number is required!',
    }),


    shopAddress: z.string({
      required_error: 'Shop address is required!',
    }),

    latitude: z
      .number({
        invalid_type_error: 'Latitude must be a number!',
      })
      .optional(),

    longitude: z
      .number({
        invalid_type_error: 'Longitude must be a number!',
      })
      .optional(),

    shopLogo: z.string().optional(),

    shopImage: z
      .array(z.string(), {
        invalid_type_error: 'Shop images must be an array of strings!',
      })
      .optional(),

    qrCode: z.string().optional(),

    isVerified: z.boolean().optional(),

    followerCount: z
      .number()
      .int()
      .nonnegative()
      .default(0),

    followingCount: z
      .number()
      .int()
      .nonnegative()
      .default(0),

    ratingCount: z
      .number()
      .int()
      .nonnegative()
      .default(0),

    avgRating: z
      .number()
      .nonnegative()
      .optional()
      .default(0),
  }),
});

const updateSaloonOwner = z.object({
  body: z.object({
    shopName: z.string({
      required_error: 'Shop name is required!',
    }).optional(),

    registrationNumber: z.string({
      required_error: 'Registration number is required!',
    }).optional(),

    shopAddress: z.string({
      required_error: 'Shop address is required!',
    }).optional(),

    latitude: z
      .number({
        invalid_type_error: 'Latitude must be a number!',
      })
      .optional(),

    longitude: z
      .number({
        invalid_type_error: 'Longitude must be a number!',
      })
      .optional(),

    shopLogo: z.string().optional(),

    shopImage: z
      .array(z.string(), {
        invalid_type_error: 'Shop images must be an array of strings!',
      })
      .optional(),

    qrCode: z.string().optional(),

    isVerified: z.boolean().optional(),

    followerCount: z
      .number()
      .int()
      .nonnegative()
      .default(0),

    followingCount: z
      .number()
      .int()
      .nonnegative()
      .default(0),

    ratingCount: z
      .number()
      .int()
      .nonnegative()
      .default(0),

    avgRating: z
      .number()
      .nonnegative()
      .optional()
      .default(0),
  }),
});

 const updateBarber = z.object({
  body: z.object({

    saloonOwnerId: z.string().optional(),

    currentWorkDes: z.string().optional(),

    bio: z.string().optional(),

   portfolio: z
      .array(z.string(), {
        invalid_type_error: 'Portfolio images must be an array of strings!',
      })
      .optional(), 

    isAvailable: z.boolean().optional(),

    experienceYears: z.string().optional(),

    skills: z
      .array(z.string(), {
        invalid_type_error: 'Skills must be an array of strings!',
      })
      .optional(),

    followerCount: z
      .number()
      .int()
      .nonnegative()
      .default(0),

    followingCount: z
      .number()
      .int()
      .nonnegative()
      .default(0),

    ratingCount: z
      .number()
      .int()
      .nonnegative()
      .default(0),

    avgRating: z
      .number()
      .nonnegative()
      .optional()
      .default(0),
  }),
});


export const UserValidations = {
  registerUser,
  updateProfileSchema,
  updateSaloonOwner,
  updatePasswordSchema,
  forgetPasswordSchema,
  verifyOtpSchema,
  changePasswordSchema,
  socialLoginSchema,
  createSaloonOwner,
  updateBarber,
};
