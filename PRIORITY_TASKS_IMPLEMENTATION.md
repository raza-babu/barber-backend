# Priority Tasks - Implementation Guide
## Features to Build RIGHT NOW

**Document Version:** 1.0  
**Last Updated:** 2026-06-16  
**Total Priority Tasks:** 23  
**Estimated Duration:** 3-4 weeks  
**Estimated Effort:** 100-120 hours  

---

## PHASE 1: USER BLOCKING SYSTEM
**Timeline:** Week 1-2  
**Estimated Effort:** 50-60 hours

---

## Task 1: Create UserBlock Model
**Estimated Time:** 2-3 hours  
**File to Create:** `prisma/schema/models/UserBlock.prisma`

Create the UserBlock model to track blocking relationships between users.

```prisma
model UserBlock {
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  blockerId     String   @db.ObjectId
  blockedUserId String   @db.ObjectId
  reason        String?
  blockedAt     DateTime @default(now())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  blocker       User     @relation("BlockerUser", fields: [blockerId], references: [id], onDelete: Cascade)
  blockedUser   User     @relation("BlockedUser", fields: [blockedUserId], references: [id], onDelete: Cascade)
  
  @@unique([blockerId, blockedUserId])
  @@map("user_blocks")
}
```

Run migration:
```bash
npx prisma migrate dev --name add_user_block
```

---

## Task 2: Update User Model with Block Relations
**Estimated Time:** 1-2 hours  
**File to Modify:** `prisma/schema/models/User.prisma`

Add blocking relationships to User model:

```prisma
model User {
  // ... existing fields ...
  blockedUsers    UserBlock[] @relation("BlockerUser")
  blockedByUsers  UserBlock[] @relation("BlockedUser")
  // ... rest of model ...
}
```

Run migration:
```bash
npx prisma migrate dev --name add_blocking_relations
```

---

## Task 3: Implement UserBlockService
**Estimated Time:** 5-6 hours  
**File to Create:** `src/app/modules/userBlock/userBlock.service.ts`

Create service with blocking operations:

```typescript
import { PrismaClient } from "@prisma/client";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";

const prisma = new PrismaClient();

export class UserBlockService {
  static async blockUser(
    blockerId: string,
    blockedUserId: string,
    reason?: string
  ): Promise<void> {
    if (blockerId === blockedUserId) {
      throw new AppError(httpStatus.BAD_REQUEST, "Cannot block yourself");
    }

    const existing = await prisma.userBlock.findUnique({
      where: {
        blockerId_blockedUserId: {
          blockerId,
          blockedUserId,
        },
      },
    });

    if (existing) {
      throw new AppError(httpStatus.CONFLICT, "User already blocked");
    }

    await prisma.userBlock.create({
      data: {
        blockerId,
        blockedUserId,
        reason,
      },
    });
  }

  static async unblockUser(blockerId: string, blockedUserId: string): Promise<void> {
    await prisma.userBlock.delete({
      where: {
        blockerId_blockedUserId: {
          blockerId,
          blockedUserId,
        },
      },
    });
  }

  static async isUserBlocked(blockerId: string, blockedUserId: string): Promise<boolean> {
    const block = await prisma.userBlock.findUnique({
      where: {
        blockerId_blockedUserId: {
          blockerId,
          blockedUserId,
        },
      },
    });
    return !!block;
  }

  static async getBlockedUsers(userId: string) {
    return prisma.userBlock.findMany({
      where: { blockerId: userId },
      include: {
        blockedUser: {
          select: {
            id: true,
            fullName: true,
            image: true,
            role: true,
          },
        },
      },
    });
  }

  static async getBlockingUsers(userId: string) {
    return prisma.userBlock.findMany({
      where: { blockedUserId: userId },
      include: {
        blocker: {
          select: {
            id: true,
            fullName: true,
            image: true,
            role: true,
          },
        },
      },
    });
  }

  static async areMutuallyBlocked(userId1: string, userId2: string): Promise<boolean> {
    const blocked1 = await this.isUserBlocked(userId1, userId2);
    const blocked2 = await this.isUserBlocked(userId2, userId1);
    return blocked1 || blocked2;
  }
}
```

---

## Task 4: Create Validation Schemas
**Estimated Time:** 2 hours  
**File to Create:** `src/app/modules/userBlock/userBlock.validation.ts`

```typescript
import { z } from "zod";

export const blockUserSchema = z.object({
  body: z.object({
    blockedUserId: z.string().min(1, "User ID is required"),
    reason: z.string().max(500).optional(),
  }),
});

export const unblockUserSchema = z.object({
  params: z.object({
    userId: z.string().min(1, "User ID is required"),
  }),
});

export type BlockUserInput = z.infer<typeof blockUserSchema>["body"];
export type UnblockUserInput = z.infer<typeof unblockUserSchema>["params"];
```

---

## Task 5: Create UserBlockController
**Estimated Time:** 3-4 hours  
**File to Create:** `src/app/modules/userBlock/userBlock.controller.ts`

```typescript
import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { UserBlockService } from "./userBlock.service";

export class UserBlockController {
  static blockUser = catchAsync(async (req, res) => {
    const user = req.user as any;
    const { blockedUserId, reason } = req.body;

    await UserBlockService.blockUser(user.id, blockedUserId, reason);

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "User blocked successfully",
      data: null,
    });
  });

  static unblockUser = catchAsync(async (req, res) => {
    const user = req.user as any;
    const { userId } = req.params;

    await UserBlockService.unblockUser(user.id, userId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "User unblocked successfully",
      data: null,
    });
  });

  static getBlockedList = catchAsync(async (req, res) => {
    const user = req.user as any;
    const blockedUsers = await UserBlockService.getBlockedUsers(user.id);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Blocked users list retrieved successfully",
      data: blockedUsers,
    });
  });

  static getBlockingList = catchAsync(async (req, res) => {
    const user = req.user as any;
    const blockingUsers = await UserBlockService.getBlockingUsers(user.id);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Users blocking you retrieved successfully",
      data: blockingUsers,
    });
  });
}
```

---

## Task 6: Create UserBlockRoutes
**Estimated Time:** 1-2 hours  
**File to Create:** `src/app/modules/userBlock/userBlock.routes.ts`

```typescript
import express from "express";
import auth from "../../middlewares/auth";
import { UserBlockController } from "./userBlock.controller";

const router = express.Router();

router.post(
  "/block/:userId",
  auth(),
  UserBlockController.blockUser
);

router.delete(
  "/block/:userId",
  auth(),
  UserBlockController.unblockUser
);

router.get(
  "/blocked-list",
  auth(),
  UserBlockController.getBlockedList
);

router.get(
  "/blocking-list",
  auth(),
  UserBlockController.getBlockingList
);

export const UserBlockRoutes = router;
```

Add to main app routes file.

---

## Task 7: Create Blocking Middleware
**Estimated Time:** 3-4 hours  
**File to Create:** `src/app/middlewares/checkBlockingStatus.ts`

```typescript
import { NextFunction, Request, Response } from "express";
import { UserBlockService } from "../modules/userBlock/userBlock.service";
import AppError from "../errors/AppError";
import httpStatus from "http-status";

export const checkBlockingStatus = 
  (targetUserIdField: string = "targetUserId") =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any;
      const targetUserId = req.body[targetUserIdField] || req.params[targetUserIdField];

      if (!targetUserId || !user?.id) {
        return next();
      }

      const blocked = await UserBlockService.areMutuallyBlocked(
        user.id,
        targetUserId
      );

      if (blocked) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "Cannot interact with this user - blocking rules apply"
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
```

---

## Task 8: Integrate Blocking into Booking Routes
**Estimated Time:** 2-3 hours  
**File to Modify:** `src/app/modules/booking/booking.routes.ts`

Add middleware to booking creation:

```typescript
import { checkBlockingStatus } from "../../middlewares/checkBlockingStatus";

router.post(
  "/create",
  auth(UserRoleEnum.CUSTOMER),
  checkBlockingStatus("saloonOwnerId"),
  validateRequest(createBookingSchema),
  bookingController.createBooking
);
```

---

## Task 9: Integrate Blocking into Messaging Routes
**Estimated Time:** 2-3 hours  
**File to Modify:** Chat/messaging routes

Add blocking check to message sending endpoints:

```typescript
router.post(
  "/send",
  auth(),
  checkBlockingStatus("recipientId"),
  chatController.sendMessage
);
```

---

## Task 10: Integrate Blocking into Queue Routes
**Estimated Time:** 2-3 hours  
**File to Modify:** Queue routes

Add blocking check:

```typescript
router.post(
  "/join",
  auth(UserRoleEnum.CUSTOMER),
  checkBlockingStatus("saloonOwnerId"),
  queueController.joinQueue
);
```

---

## Task 11: Integrate Blocking into Profile Access
**Estimated Time:** 2-3 hours  
**File to Modify:** User/profile controller

```typescript
router.get(
  "/profile/:userId",
  auth(),
  async (req, res, next) => {
    const user = req.user as any;
    const targetUserId = req.params.userId;
    
    const blocked = await UserBlockService.isUserBlocked(
      user.id,
      targetUserId
    );
    
    if (blocked) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You cannot view this profile"
      );
    }
    
    next();
  },
  profileController.getProfile
);
```

---

## Task 12: Write User Blocking Tests
**Estimated Time:** 6-8 hours  
**File to Create:** `src/app/modules/userBlock/userBlock.test.ts`

Create comprehensive tests for:
- Block user successfully
- Prevent self-blocking
- Prevent duplicate blocks
- Unblock user
- Get blocked/blocking users lists
- Prevent booking with blocked shop
- Prevent messaging blocked user
- Prevent queue join with blocked shop
- Prevent profile access when blocked

---

## PHASE 2: CUSTOMER PROFILE SYSTEM
**Timeline:** Week 2-3  
**Estimated Effort:** 35-40 hours

---

## Task 13: Create CustomerProfile Model
**Estimated Time:** 2-3 hours  
**File to Create:** `prisma/schema/models/CustomerProfile.prisma`

```prisma
model CustomerProfile {
  id               String   @id @default(auto()) @map("_id") @db.ObjectId
  userId           String   @unique @db.ObjectId
  
  bio              String?
  preferredBarberIds String[]? @db.ObjectId
  
  haircutPhotos    String[]?
  haircutVideos    String[]?
  
  hairstyleNotes   String?
  preferredStyles  String[]?
  allergyNotes     String?
  
  isProfilePublic  Boolean   @default(true)
  allowBarberComments Boolean @default(true)
  
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("customer_profiles")
}
```

Run migration:
```bash
npx prisma migrate dev --name add_customer_profile
```

---

## Task 14: Update User Model with Profile Relation
**Estimated Time:** 1 hour  
**File to Modify:** `prisma/schema/models/User.prisma`

```prisma
model User {
  // ... existing fields ...
  customerProfile  CustomerProfile?
  // ... rest ...
}
```

---

## Task 15: Create Storage Service
**Estimated Time:** 3-4 hours  
**File to Create:** `src/app/services/storage.service.ts`

Example using Cloudinary:

```typescript
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export class StorageService {
  static async uploadImage(
    fileBuffer: Buffer,
    fileName: string,
    folder: string = "barber-app/profiles"
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: "auto",
          public_id: fileName,
          overwrite: true,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result!.secure_url);
        }
      );
      uploadStream.end(fileBuffer);
    });
  }

  static async uploadVideo(
    fileBuffer: Buffer,
    fileName: string,
    folder: string = "barber-app/videos"
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: "video",
          public_id: fileName,
          overwrite: true,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result!.secure_url);
        }
      );
      uploadStream.end(fileBuffer);
    });
  }

  static async deleteFile(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }

  static async deleteVideo(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { resource_type: "video" });
  }
}
```

Environment variables:
```env
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
```

---

## Task 16: Create CustomerProfileService
**Estimated Time:** 6-7 hours  
**File to Create:** `src/app/modules/customerProfile/customerProfile.service.ts`

Implement service with CRUD operations:
- getOrCreateProfile(userId)
- getProfile(userId)
- updateProfile(userId, data)
- addHaircutPhoto(userId, fileBuffer, fileName)
- addHaircutVideo(userId, fileBuffer, fileName)
- removePhoto(userId, photoUrl)
- removeVideo(userId, videoUrl)
- updatePreferredStyles(userId, styles)
- updatePreferredBarbers(userId, barberIds)

---

## Task 17: Create Customer Profile Privacy Service
**Estimated Time:** 4-5 hours  
**File to Create:** `src/app/modules/customerProfile/customerProfile.privacy.service.ts`

Implement privacy controls:
- canViewProfile(requesterId, targetUserId) - Returns true if user can view
- hasBookingOrQueueRelationship(userId1, userId2) - Check if booking/queue exists
- getAccessibleProfile(requesterId, targetUserId) - Get profile with access control
- getAccessReason(requesterId, targetUserId) - Return reason for access

Rules:
- Customer can always view own profile
- Public profiles visible to all
- Private profiles only to those with booking/queue relationship

---

## Task 18: Create Profile Validation Schemas
**Estimated Time:** 2 hours  
**File to Create:** `src/app/modules/customerProfile/customerProfile.validation.ts`

Create schemas for:
- updateProfileSchema
- uploadPhotoSchema
- uploadVideoSchema
- updatePreferredStylesSchema

---

## Task 19: Create CustomerProfileController
**Estimated Time:** 4-5 hours  
**File to Create:** `src/app/modules/customerProfile/customerProfile.controller.ts`

Implement methods:
- getProfile(req, res)
- getPublicProfile(req, res)
- updateProfile(req, res)
- uploadPhoto(req, res)
- uploadVideo(req, res)
- removePhoto(req, res)
- removeVideo(req, res)
- updatePreferredStyles(req, res)

---

## Task 20: Create Customer Profile Routes
**Estimated Time:** 2-3 hours  
**File to Create:** `src/app/modules/customerProfile/customerProfile.routes.ts`

Routes:
```
GET    /customer/my-profile
PUT    /customer/my-profile
GET    /customer/view/:userId
POST   /customer/upload-photo
POST   /customer/upload-video
DELETE /customer/photo/:photoUrl
DELETE /customer/video/:videoUrl
PUT    /customer/preferences/styles
```

---

## Task 21: Write Customer Profile Tests
**Estimated Time:** 5-6 hours  
**File to Create:** `src/app/modules/customerProfile/customerProfile.test.ts`

Test cases:
- Create/get profile
- Update profile info
- Upload/remove photo
- Upload/remove video
- Privacy control - public profile access
- Privacy control - private profile denial
- Privacy control - booking relationship access
- Customer views own profile
- Preferred styles/barbers management

---

## PHASE 3: NOTIFICATION PROFILE PICTURES
**Timeline:** Week 3-4  
**Estimated Effort:** 10-15 hours

---

## Task 22: Update Notification Model
**Estimated Time:** 2 hours  
**File to Modify:** `prisma/schema/models/Notification.prisma`

Add fields:
```prisma
model Notification {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  userId    String   @db.ObjectId
  title     String
  body      String
  data      String?
  isRead    Boolean  @default(false)
  isClicked Boolean  @default(false)
  
  senderId      String?   @db.ObjectId
  senderImage   String?
  senderType    String?
  senderName    String?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  user      User     @relation(fields: [userId], references: [id])
  sender    User?    @relation("NotificationSender", fields: [senderId], references: [id])
  
  @@map("notifications")
}
```

Also update User model:
```prisma
model User {
  // ...
  sentNotifications Notification[] @relation("NotificationSender")
  // ...
}
```

---

## Task 23: Update Notification Service
**Estimated Time:** 4-5 hours  
**File to Modify:** `src/app/modules/notification/notification.service.ts`

Update createNotification method to:
- Accept senderId and senderType parameters
- Fetch sender's profile image from database
- Fetch sender's name
- Store in notification record
- Handle missing sender gracefully

Update getNotifications to return:
- senderImage
- senderName
- senderType in response

---

## IMPLEMENTATION CHECKLIST

### Week 1: User Blocking
- Task 1: UserBlock model
- Task 2: User model update
- Task 3: UserBlockService
- Task 4: Validation schemas
- Task 5: UserBlockController
- Task 6: UserBlockRoutes
- Task 7: Blocking middleware
- Task 12: Tests

### Week 2: Booking/Messaging/Queue Integration + Profile Start
- Task 8: Booking integration
- Task 9: Messaging integration
- Task 10: Queue integration
- Task 11: Profile access integration
- Task 13: CustomerProfile model
- Task 14: User model update
- Task 15: Storage service

### Week 3: Profile System Complete
- Task 16: ProfileService
- Task 17: Privacy service
- Task 18: Validation schemas
- Task 19: ProfileController
- Task 20: Profile routes
- Task 21: Profile tests
- Task 22: Notification model update

### Week 4: Notification Polish
- Task 23: Notification service update

---

## ENVIRONMENT VARIABLES REQUIRED

```env
# Storage (choose one provider)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# OR AWS S3
AWS_S3_BUCKET=
AWS_S3_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# OR Firebase
FIREBASE_STORAGE_BUCKET=
FIREBASE_PROJECT_ID=
```

---

## HOW TO START

1. Begin with Task 1 in Week 1
2. Complete database migrations before writing service code
3. Write tests as you go
4. Test integrations after connecting to other modules
5. Each task builds on previous tasks - do not skip

Estimated completion: 3-4 weeks with 1-2 developers
