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
      .string({
        required_error: 'Intended role is required!',
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


export const createSaloonOwner = z.object({
  body: z.object({
    userId: z.string({
      required_error: 'User ID is required!',
    }),

    shopName: z.string({
      required_error: 'Shop name is required!',
    }),

    registrationNumber: z.string({
      required_error: 'Registration number is required!',
    }),

    number: z.string({
      required_error: 'Contact number is required!',
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


export const createBarber = z.object({
  body: z.object({
    userId: z.string({
      required_error: 'User ID is required!',
    }),

    saloonOwnerId: z.string().optional(),

    currentWorkDes: z.string().optional(),

    bio: z.string().optional(),

    gender: z.enum(['Male', 'Female', 'Other']).optional(),

    dob: z
      .string()
      .datetime({
        message: 'Date of birth must be a valid ISO date string!',
      })
      .optional(),

    number: z.string().optional(),

    images: z.string().optional(),

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
  updatePasswordSchema,
  forgetPasswordSchema,
  verifyOtpSchema,
  changePasswordSchema,
  socialLoginSchema,
  createSaloonOwner,
  createBarber,
};
