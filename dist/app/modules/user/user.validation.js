"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserValidations = void 0;
const zod_1 = __importDefault(require("zod"));
const registerUser = zod_1.default.object({
    body: zod_1.default.object({
        fullName: zod_1.default.string({
            required_error: 'Name is required!',
        }),
        email: zod_1.default
            .string({
            required_error: 'Email is required!',
        })
            .email({
            message: 'Invalid email format!',
        }),
        password: zod_1.default.string({
            required_error: 'Password is required!',
        }),
        intendedRole: zod_1.default
            .enum(['CUSTOMER', 'SALOON_OWNER', 'BARBER'], {
            required_error: 'Role is required!',
        })
            .optional(),
    }),
});
const updateProfileSchema = zod_1.default.object({
    body: zod_1.default.object({
        fullName: zod_1.default
            .string({
            required_error: 'Name is required!',
        })
            .optional(),
        gender: zod_1.default
            .string({
            required_error: 'Password is required!',
        })
            .optional(),
        phoneNumber: zod_1.default
            .string({
            required_error: 'Phone number is required!',
        })
            .optional(),
    }),
    dateOfBirth: zod_1.default
        .string({
        required_error: 'Date of birth is required!',
    })
        .optional(),
});
const updatePasswordSchema = zod_1.default.object({
    body: zod_1.default.object({
        email: zod_1.default
            .string({
            required_error: 'Email is required!',
        })
            .email({
            message: 'Invalid email format!',
        }),
        password: zod_1.default.string({
            required_error: 'Password is required!',
        }),
    }),
});
const forgetPasswordSchema = zod_1.default.object({
    body: zod_1.default.object({
        email: zod_1.default
            .string({
            required_error: 'Email is required!',
        })
            .email({
            message: 'Invalid email format!',
        }),
    }),
});
const changePasswordSchema = zod_1.default.object({
    body: zod_1.default.object({
        email: zod_1.default
            .string({
            required_error: 'Email is required!',
        })
            .email({
            message: 'Invalid email format!',
        }),
        newPassword: zod_1.default.string({
            required_error: 'Password is required!',
        }),
    }),
});
const verifyOtpSchema = zod_1.default.object({
    body: zod_1.default.object({
        email: zod_1.default
            .string({
            required_error: 'Email is required!',
        })
            .email({
            message: 'Invalid email format!',
        }),
        otp: zod_1.default.number({
            required_error: 'OTP is required!',
        }),
    }),
});
const socialLoginSchema = zod_1.default.object({
    body: zod_1.default.object({
        email: zod_1.default
            .string({
            required_error: 'Email is required!',
        })
            .email({
            message: 'Invalid email format!',
        })
            .optional(),
        fullName: zod_1.default.string({
            required_error: 'name is required!',
        }),
        fcmToken: zod_1.default.string({
            required_error: 'Fcm token is required!',
        }),
        role: zod_1.default.string({
            required_error: 'Role is required!',
        }),
    }),
});
const createSaloonOwner = zod_1.default.object({
    body: zod_1.default.object({
        email: zod_1.default
            .string({
            required_error: 'Email is required!',
        })
            .email({
            message: 'Invalid email format!',
        }),
        shopName: zod_1.default.string({
            required_error: 'Shop name is required!',
        }),
        registrationNumber: zod_1.default.string({
            required_error: 'Registration number is required!',
        }),
        shopAddress: zod_1.default.string({
            required_error: 'Shop address is required!',
        }),
        latitude: zod_1.default
            .number({
            invalid_type_error: 'Latitude must be a number!',
        })
            .optional(),
        longitude: zod_1.default
            .number({
            invalid_type_error: 'Longitude must be a number!',
        })
            .optional(),
        shopLogo: zod_1.default.string().optional(),
        shopImage: zod_1.default
            .array(zod_1.default.string(), {
            invalid_type_error: 'Shop images must be an array of strings!',
        })
            .optional(),
        qrCode: zod_1.default.string().optional(),
        isVerified: zod_1.default.boolean().optional(),
        followerCount: zod_1.default
            .number()
            .int()
            .nonnegative()
            .default(0),
        followingCount: zod_1.default
            .number()
            .int()
            .nonnegative()
            .default(0),
        ratingCount: zod_1.default
            .number()
            .int()
            .nonnegative()
            .default(0),
        avgRating: zod_1.default
            .number()
            .nonnegative()
            .optional()
            .default(0),
    }),
});
const updateSaloonOwner = zod_1.default.object({
    body: zod_1.default.object({
        shopName: zod_1.default.string({
            required_error: 'Shop name is required!',
        }).optional(),
        registrationNumber: zod_1.default.string({
            required_error: 'Registration number is required!',
        }).optional(),
        shopAddress: zod_1.default.string({
            required_error: 'Shop address is required!',
        }).optional(),
        latitude: zod_1.default
            .number({
            invalid_type_error: 'Latitude must be a number!',
        })
            .optional(),
        longitude: zod_1.default
            .number({
            invalid_type_error: 'Longitude must be a number!',
        })
            .optional(),
        shopLogo: zod_1.default.string().optional(),
        shopImage: zod_1.default
            .array(zod_1.default.string(), {
            invalid_type_error: 'Shop images must be an array of strings!',
        })
            .optional(),
        qrCode: zod_1.default.string().optional(),
        isVerified: zod_1.default.boolean().optional(),
        followerCount: zod_1.default
            .number()
            .int()
            .nonnegative()
            .default(0),
        followingCount: zod_1.default
            .number()
            .int()
            .nonnegative()
            .default(0),
        ratingCount: zod_1.default
            .number()
            .int()
            .nonnegative()
            .default(0),
        avgRating: zod_1.default
            .number()
            .nonnegative()
            .optional()
            .default(0),
    }),
});
const updateBarber = zod_1.default.object({
    body: zod_1.default.object({
        saloonOwnerId: zod_1.default.string().optional(),
        currentWorkDes: zod_1.default.string().optional(),
        bio: zod_1.default.string().optional(),
        portfolio: zod_1.default
            .array(zod_1.default.string(), {
            invalid_type_error: 'Portfolio images must be an array of strings!',
        })
            .optional(),
        isAvailable: zod_1.default.boolean().optional(),
        experienceYears: zod_1.default.string().optional(),
        skills: zod_1.default
            .array(zod_1.default.string(), {
            invalid_type_error: 'Skills must be an array of strings!',
        })
            .optional(),
        followerCount: zod_1.default
            .number()
            .int()
            .nonnegative()
            .default(0),
        followingCount: zod_1.default
            .number()
            .int()
            .nonnegative()
            .default(0),
        ratingCount: zod_1.default
            .number()
            .int()
            .nonnegative()
            .default(0),
        avgRating: zod_1.default
            .number()
            .nonnegative()
            .optional()
            .default(0),
    }),
});
exports.UserValidations = {
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
