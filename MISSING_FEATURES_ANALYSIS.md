# Comprehensive Missing Features Analysis

## Barber Booking Platform Backend

**Document Generated:** 2026-06-16  
**Analysis Type:** Codebase vs Requirements Gap Analysis  
**Total Modules:** 37  
**Critical Missing Features:** 9  
**High Priority Missing Features:** 8

---

## Executive Summary

Based on comprehensive analysis of the codebase and requirements document, **17 major feature gaps** have been identified across **9 functional areas**. These gaps affect core booking functionality, payment processing, user safety, authentication, and profile management.

**Critical Impact Areas:**

- Deposit booking system (CRITICAL) (don't need right now)
- Remaining balance payment collection workflow (CRITICAL) (don't need right now)
- User blocking and reporting (HIGH)
- Customer profile with portfolio (HIGH)
- Facebook authentication (HIGH) (don't to work right now)
- Notification profile pictures (MEDIUM-HIGH)

---

## Missing Features by Module

### 1. BOOKING MODULE 🔴 CRITICAL

**Files:** `src/app/modules/booking/`  
**Current Status:** Partial Implementation  
**Missing Components:** Deposit system, cancellation policy enforcement, remaining balance tracking

#### 1.1 Deposit Payment Option ❌ (don't need deposit payment )

- **Requirement:** Customers should choose between paying deposit or full amount
- **Current Implementation:** ❌ NOT IMPLEMENTED
- **Database Gap:**
  - Missing fields in `Booking` model:
    - `depositAmount` (Float)
    - `remainingBalance` (Float)
    - `paymentType` (enum: DEPOSIT, FULL)
    - `depositPaidAt` (DateTime?)
    - `remainingBalancePaidAt` (DateTime?)
    - `remainingBalancePaymentMethod` (String?)
- **Service Gap:** No logic to calculate and offer deposit vs full payment options
- **API Gap:** No endpoints to specify payment preference
- **Priority:** CRITICAL
- **Affected APIs:**
  - POST /booking/create
  - GET /booking/details
  - POST /booking/payment

#### 1.2 Shop Owner Deposit Configuration ❌ (don't need deposit payment )

- **Requirement:** Owners configure deposit amounts, cancellation windows, refund rules
- **Current Implementation:** ❌ NOT IMPLEMENTED
- **Database Gap:**
  - Missing model: `DepositPolicy` or extend `SaloonOwner`:
    - `depositAmount` (Float or percentage)
    - `cancellationWindow` (hours)
    - `refundPercentage` (Float)
    - `acceptedPaymentMethods` (Array)
- **Service Gap:** No admin endpoints for deposit policy configuration
- **Priority:** CRITICAL

#### 1.3 Cancellation Logic with Deposit Handling ❌ (don't need deposit payment )

- **Requirement:** Enforce refund rules based on cancellation time
- **Current Implementation:** ⚠️ PARTIAL (booking cancellation exists, deposit logic missing)
- **Database Gap:**
  - Booking model needs: `cancellationReason`, `refundAmount`, `refundStatus`
  - Need to track whether deposit is forfeited or refunded
- **Service Gap:**
  - No logic to check cancellation window
  - No logic to apply deposit forfeiture rules
  - No logic to calculate refund amounts
- **Priority:** CRITICAL

#### 1.4 No-Show Protection ❌ (don't need deposit payment )

- **Requirement:** Retain deposit if customer doesn't attend
- **Current Implementation:** ❌ NOT IMPLEMENTED
- **Database Gap:**
  - Need to track: `noShowDepositForfeited` (Boolean)
- **Service Gap:**
  - No logic to automatically forfeit deposits on NO_SHOW status
- **Priority:** CRITICAL

#### 1.5 Remaining Balance Collection Workflow ❌ (don't need deposit payment )

- **Requirement:** Owner collects remaining balance when customer arrives
- **Current Implementation:** ❌ NOT IMPLEMENTED
- **Database Gap:**
  - Payment model needs:
    - `paymentStage` (DEPOSIT, REMAINING_BALANCE, FULL)
    - `collectedAt` (DateTime)
    - `collectionMethod` (CASH, CARD, ONLINE, ALREADY_PAID)
- **Service Gap:**
  - No endpoint for owner to record remaining balance payment
  - No checkout/payment collection screen logic
  - No payment status management (UNPAID → DEPOSIT_PAID → FULLY_PAID)
- **API Gap:**
  - Missing: POST /booking/{id}/collect-remaining-balance
  - Missing: GET /booking/{id}/payment-summary
- **Priority:** CRITICAL

#### 1.6 QR Code Booking Integration ❌ (don't need deposit payment )

- **Requirement:** After scanning QR, customers see "Join Queue" or "Book Appointment"
- **Current Implementation:** ⚠️ PARTIAL (QR exists, booking flow not integrated)
- **Service Gap:**
  - No logic to redirect from QR to booking page with options
  - Flow not properly implemented
- **Priority:** HIGH

---

### 2. PAYMENT MODULE 🔴 CRITICAL (don't need deposit payment )

**Files:** `src/app/modules/payment/`  
**Current Status:** Partial Implementation  
**Missing Components:** Deposit amount handling, remaining balance, escrow logic

#### 2.1 Deposit Amount Processing ❌ (don't need deposit payment )

- **Requirement:** Process deposit amount, not full service price
- **Current Implementation:** ❌ NOT IMPLEMENTED
- **Database Gap:**
  - Payment model needs:
    - `paymentStage` (enum: DEPOSIT, REMAINING_BALANCE)
    - `depositAmount` (Float)
    - `remainingAmount` (Float)
- **Service Gap:**
  - No logic to calculate and charge only deposit
  - No logic to handle remaining balance at shop
- **Priority:** CRITICAL

#### 2.2 Escrow Integration ❌ (don't need deposit payment )

- **Requirement:** Hold payments in escrow, release after appointment completion
- **Current Implementation:** ❌ NOT IMPLEMENTED
- **Database Gap:**
  - Payment model needs:
    - `escrowStatus` (HELD, RELEASED, FORFEITED)
    - `escrowReleasedAt` (DateTime?)
- **Service Gap:**
  - No logic to hold payments in escrow
  - No logic to release escrow on appointment completion
  - No logic to forfeit escrow on no-show
- **Priority:** CRITICAL

#### 2.3 Full Payment Refund Logic ❌ (don't need deposit payment )

- **Requirement:** Process refunds for full-pay customers based on cancellation policy
- **Current Implementation:** ⚠️ PARTIAL (refund endpoint exists, policy not enforced)
- **Service Gap:**
  - No cancellation policy checking
  - No refund calculation based on time window
  - No partial refund logic for late cancellations
- **Priority:** CRITICAL

#### 2.4 Remaining Balance Payment Collection ❌ (don't need deposit payment )

- **Requirement:** Record remaining balance payment at shop with multiple methods
- **Current Implementation:** ❌ NOT IMPLEMENTED
- **Database Gap:**
  - Payment model needs better support for multi-stage payments
- **Service Gap:**
  - No endpoint to record cash/card payment at shop
  - No payment completion workflow
- **API Gap:**
  - Missing: POST /payment/record-remaining-balance
  - Missing: POST /payment/confirm-appointment-payment
- **Priority:** CRITICAL

---

### 3. CUSTOMER MODULE 🟡 HIGH (need right now)

**Files:** `src/app/modules/customer/`  
**Current Status:** Not Implemented  
**Missing Components:** Customer profile with portfolio, photos, videos

#### 3.1 Customer Profile with Portfolio ❌ (need right now)

- **Requirement:** Customers upload haircut photos, videos, references, hairstyle notes
- **Current Implementation:** ❌ NOT IMPLEMENTED (Customer model is commented out)
- **Database Gap:**
  - Need new model `CustomerProfile`:
    - `userId` (String, unique)
    - `bio` (String?)
    - `preferredBarberIds` (Array<String>)
    - `haircutPhotos` (Array<String> - image URLs)
    - `haircutVideos` (Array<String> - video URLs)
    - `hairstyleNotes` (String?)
    - `preferredStyles` (Array<String>)
    - `createdAt`, `updatedAt`
  - Or extend User model with these fields
- **Service Gap:**
  - No upload endpoints for photos/videos
  - No retrieval endpoints
  - No privacy/access control logic
- **API Gap:**
  - Missing: POST /customer/profile/upload-photo
  - Missing: POST /customer/profile/upload-video
  - Missing: GET /customer/profile
  - Missing: PUT /customer/profile
- **Priority:** HIGH

#### 3.2 Customer Profile Privacy Control ❌ (need right now)

- **Requirement:** Barbers can only view profile if they have booking/queue with customer
- **Current Implementation:** ❌ NOT IMPLEMENTED
- **Service Gap:**
  - No authorization logic to check booking/queue relationship
  - No privacy settings
- **Priority:** HIGH

---

### 4. BARBER MODULE 🟡 HIGH

**Files:** `src/app/modules/barber/`, `src/app/modules/barberSchedule/`  
**Current Status:** Partial Implementation  
**Missing Components:** Permanent vs Temporary barber distinction, management features

#### 4.1 Permanent & Temporary Barber Management ❌ (don't need right now)

- **Requirement:** Shop owners assign barbers as Permanent or Temporary
- **Current Implementation:** ⚠️ PARTIAL (HiredBarber exists, no permanent/temporary distinction)
- **Database Gap:**
  - Extend `HiredBarber` model:
    - `barberType` (enum: PERMANENT, TEMPORARY)
    - `endDate` (DateTime? - for temporary barbers)
    - `status` (enum: ACTIVE, INACTIVE, ON_LEAVE)
- **Service Gap:**
  - No logic to distinguish barber types
  - No workflow for temporary barber removal
  - No automatic status updates
- **API Gap:**
  - Missing: POST /barber/assign (with type)
  - Missing: PUT /barber/{id}/type
  - Missing: DELETE /barber/{id}/remove
- **Priority:** HIGH

#### 4.2 Barber Holiday & Schedule Management ⚠️ (we have already)

- **Requirement:** Owners manage barber working days, holidays, availability
- **Current Implementation:** ⚠️ PARTIAL (Models exist but integration incomplete)
- **Models:** `BarberSchedule`, `BarberDayOff`, `BarberLunch` exist
- **Service Gap:**
  - May need better integration and UI for management
- **Priority:** MEDIUM (partially implemented)

---

### 5. AUTHENTICATION MODULE 🟡 HIGH (already we have )

**Files:** `src/app/modules/auth/`  
**Current Status:** Partial Implementation  
**Missing Components:** Facebook Sign-In

#### 5.1 Facebook Authentication ❌ (we have already)

- **Requirement:** Add Facebook as authentication method alongside Google/Apple
- **Current Implementation:** ❌ NOT IMPLEMENTED
- **Database Gap:**
  - `PlatFormType` enum exists with GOOGLE, APPLE, **FACEBOOK missing**
  - Need to add: `facebookId` (String?) to User model
  - Need to add: `facebookAccessToken` (String?) to User model
- **Service Gap:**
  - No Facebook OAuth integration logic
  - No Facebook token validation
  - No Facebook user profile fetch
- **API Gap:**
  - Missing: POST /auth/facebook-login
  - Missing: POST /auth/facebook-callback
- **Priority:** HIGH
- **Integration Required:** Facebook App setup, OAuth credentials

---

### 6. NOTIFICATION MODULE 🟡 MEDIUM-HIGH (need right now)

**Files:** `src/app/modules/notification/`  
**Current Status:** Basic Implementation  
**Missing Components:** Profile picture display in notifications

#### 6.1 Notification Profile Pictures ❌

- **Requirement:** Notifications display sender's profile image (avatar/photo/logo)
- **Current Implementation:** ❌ NOT IMPLEMENTED
- **Database Gap:**
  - Extend `Notification` model:
    - `senderId` (String, ObjectId? - to identify sender)
    - `senderImage` (String? - profile image URL)
    - `senderType` (enum: CUSTOMER, BARBER, SALOON_OWNER, SYSTEM)
- **Service Gap:**
  - No logic to fetch sender's image when creating notification
  - No profile picture URL resolution
- **API Gap:**
  - Notification structure needs to include sender info
- **Priority:** MEDIUM-HIGH

---

### 7. USER BLOCKING MODULE 🔴 CRITICAL (MISSING) (need right now)

**Files:** None - entire module missing  
**Current Status:** ❌ NOT IMPLEMENTED  
**Missing Components:** Complete blocking system

#### 7.1 User Blocking Feature ❌ 

- **Requirement:** Customers, barbers, shop owners block each other
- **Current Implementation:** ❌ NOT IMPLEMENTED
- **Database Gap:**
  - Need new model `UserBlock`:
    - `id` (String)
    - `blockerId` (String, ObjectId)
    - `blockedUserId` (String, ObjectId)
    - `reason` (String?)
    - `blockedAt` (DateTime)
    - `createdAt`, `updatedAt`
  - Add to User model: `blockedByUsers` (Relation)
  - Add to User model: `blockedUsers` (Relation)
- **Service Gap:**
  - No block/unblock endpoints
  - No authorization checks for blocked users
  - No validation preventing interaction with blocked users
- **API Gap:**
  - Missing: POST /user/block/{userId}
  - Missing: DELETE /user/block/{userId}
  - Missing: GET /user/blocked-list
  - Missing: GET /user/blocking-list
- **Middleware Gap:**
  - No middleware to check if users are blocked before allowing interaction
  - No check in: messaging, booking, queue, profile access
- **Priority:** CRITICAL

#### 7.2 Blocking Rules Enforcement ❌ 

- **Requirement:** Blocked users cannot message, interact, or create contact
- **Current Implementation:** ❌ NOT IMPLEMENTED
- **Service Gap:**
  - No logic to prevent booking with blocked users
  - No logic to prevent messaging with blocked users
  - No logic to prevent queue joins with blocked users
  - No profile access prevention
- **Priority:** CRITICAL

---

### 8. REPORTING MODULE 🟡 HIGH (we have already)

**Files:** `src/app/modules/supportReplies/`, `SaloonReport` model  
**Current Status:** Partial/Basic Implementation  
**Missing Components:** Comprehensive reporting for all users

#### 8.1 Generic User Reporting System ❌

- **Requirement:** Users (Customers, Barbers, Shop Owners) report each other
- **Current Implementation:** ⚠️ PARTIAL (SaloonReport exists but very limited)
- **Database Gap:**
  - Current model: `SaloonReport` (only customer reports saloon)
  - Need new model `UserReport`:
    - `id` (String)
    - `reporterId` (String, ObjectId)
    - `reportedUserId` (String, ObjectId)
    - `reportCategory` (enum: HARASSMENT, FRAUD, INAPPROPRIATE, FAKE_ACCOUNT, SERVICE_COMPLAINT, OTHER)
    - `description` (String)
    - `evidence` (Array<String> - image URLs?)
    - `status` (enum: PENDING, INVESTIGATING, RESOLVED, DISMISSED)
    - `adminNotes` (String?)
    - `createdAt`, `updatedAt`
- **Service Gap:**
  - No endpoints for creating reports
  - No admin dashboard for reviewing reports
  - No escalation workflow
  - No notification system for admins
- **API Gap:**
  - Missing: POST /report/create
  - Missing: GET /report/{reportId} (admin)
  - Missing: PUT /report/{reportId}/status (admin)
  - Missing: GET /reports (admin list)
- **Priority:** HIGH

#### 8.2 Report Handling Workflow ❌

- **Requirement:** Admin review, investigation, and resolution
- **Current Implementation:** ❌ NOT IMPLEMENTED
- **Service Gap:**
  - No admin panel functionality
  - No report tracking
  - No notification to reporter on resolution
- **Priority:** HIGH

---

### 9. SHOP DISPLAY & LOYALTY MODULE ⚠️ MEDIUM-HIGH

**Files:** `src/app/modules/loyaltyProgram/`, `src/app/modules/saloon/`  
**Current Status:** Partial Implementation  
**Missing Components:** Shop tile display with loyalty/discount info

#### 9.1 Shop Tile Discount Display ❌

- **Requirement:** Shop cards display active promotions (15% OFF, Student Discount, etc.)
- **Current Implementation:** ⚠️ PARTIAL (Ads module exists, integration unclear)
- **Database Gap:**
  - Need model or extend `SaloonOwner`:
    - `activePromotions` (Array with discount info)
    - `promotionStartDate` (DateTime)
    - `promotionEndDate` (DateTime)
    - `discountPercentage` (Float)
    - `discountDescription` (String)
- **Service Gap:**
  - No logic to retrieve active promotions with shop
  - No filtering for expired promotions
  - No dynamic update when promotions change
- **API Gap:**
  - Shop endpoints need to include promotion data
  - Missing: POST /saloon/promotion (owner endpoint)
  - Missing: PUT /saloon/promotion/{id}
- **Priority:** MEDIUM-HIGH

#### 9.2 Loyalty Programme Visibility ❌

- **Requirement:** Customers see loyalty rewards on home screen before opening shop
- **Current Implementation:** ⚠️ PARTIAL (LoyaltyProgram model exists)
- **Service Gap:**
  - No endpoint to get shop list with loyalty info
  - No filtering for enrolled loyalty programs
  - Integration with shop tile display missing
- **API Gap:**
  - Missing: GET /saloon/feed (with loyalty info included)
  - Missing: GET /saloon/search (with loyalty/promotions)
- **Priority:** MEDIUM-HIGH

---

## Summary Table: Missing Features by Priority

| Priority       | Module       | Feature                        | Status         | Effort |
| -------------- | ------------ | ------------------------------ | -------------- | ------ |
| 🔴 CRITICAL    | Booking      | Deposit Payment Option         | ❌ Not Started | HIGH   |
| 🔴 CRITICAL    | Booking      | Shop Owner Deposit Config      | ❌ Not Started | MEDIUM |
| 🔴 CRITICAL    | Booking      | Cancellation Logic             | ⚠️ Partial     | MEDIUM |
| 🔴 CRITICAL    | Booking      | No-Show Protection             | ❌ Not Started | LOW    |
| 🔴 CRITICAL    | Booking      | Remaining Balance Workflow     | ❌ Not Started | HIGH   |
| 🔴 CRITICAL    | Payment      | Deposit Amount Processing      | ❌ Not Started | HIGH   |
| 🔴 CRITICAL    | Payment      | Escrow Integration             | ❌ Not Started | HIGH   |
| 🔴 CRITICAL    | Payment      | Full Payment Refund Logic      | ⚠️ Partial     | MEDIUM |
| 🔴 CRITICAL    | Payment      | Remaining Balance Collection   | ❌ Not Started | HIGH   |
| 🔴 CRITICAL    | Blocking     | Complete Blocking System       | ❌ Not Started | MEDIUM |
| 🔴 CRITICAL    | Blocking     | Blocking Rules Enforcement     | ❌ Not Started | MEDIUM |
| 🟡 HIGH        | Customer     | Profile with Portfolio         | ❌ Not Started | HIGH   |
| 🟡 HIGH        | Customer     | Profile Privacy Control        | ❌ Not Started | MEDIUM |
| 🟡 HIGH        | Barber       | Permanent/Temporary Management | ⚠️ Partial     | MEDIUM |
| 🟡 HIGH        | Auth         | Facebook Sign-In               | ❌ Not Started | HIGH   |
| 🟡 HIGH        | Reporting    | Generic Reporting System       | ⚠️ Partial     | MEDIUM |
| 🟡 HIGH        | Reporting    | Report Workflow                | ❌ Not Started | MEDIUM |
| 🟡 MEDIUM-HIGH | Notification | Profile Pictures               | ❌ Not Started | LOW    |
| 🟡 MEDIUM-HIGH | Shop/Loyalty | Discount Display               | ⚠️ Partial     | MEDIUM |
| 🟡 MEDIUM-HIGH | Shop/Loyalty | Loyalty Visibility             | ⚠️ Partial     | MEDIUM |

---

## Database Changes Required

### New Models to Create

1. `UserBlock` - User blocking relationships
2. `UserReport` - Generic user reporting
3. `CustomerProfile` - Customer portfolio & preferences
4. `DepositPolicy` - Shop deposit configuration

### Models to Extend

1. **Booking** - Add: `depositAmount`, `remainingBalance`, `paymentType`, `depositPaidAt`, `remainingBalancePaidAt`, `cancellationReason`, `refundAmount`
2. **Payment** - Add: `paymentStage`, `depositAmount`, `remainingAmount`, `escrowStatus`, `escrowReleasedAt`, `collectionMethod`
3. **HiredBarber** - Add: `barberType`, `endDate`, `status`
4. **Notification** - Add: `senderId`, `senderImage`, `senderType`
5. **User** - Add: `facebookId`, `facebookAccessToken`
6. **PlatFormType Enum** - Add: `FACEBOOK`

### Models to Review/Enhance

1. **SaloonOwner** - Add promotion/discount fields
2. **LoyaltyProgram** - Ensure shop-specific enrollment tracking

---

## API Changes Required

### New Endpoints (Booking & Payment)

```
POST   /booking/create-with-deposit-option        # Offer deposit vs full
POST   /booking/{id}/collect-remaining-balance    # Record payment at shop
GET    /booking/{id}/payment-summary              # View payment status
POST   /saloon/{id}/deposit-config                # Configure deposit policy
```

### New Endpoints (User Management)

```
POST   /user/block/{userId}                       # Block a user
DELETE /user/block/{userId}                       # Unblock a user
GET    /user/blocked-list                         # View blocked users
GET    /user/blocking-list                        # View users blocking you
```

### New Endpoints (Reporting)

```
POST   /report/create                             # Submit report
GET    /report/{reportId}                         # View report (admin)
PUT    /report/{reportId}/status                  # Update status (admin)
GET    /reports                                   # List reports (admin)
```

### New Endpoints (Customer Profile)

```
POST   /customer/profile/upload-photo             # Upload profile photo
POST   /customer/profile/upload-video             # Upload video
GET    /customer/profile                          # View own profile
GET    /customer/{userId}/profile                 # View barber access
PUT    /customer/profile                          # Edit profile
```

### New Endpoints (Authentication)

```
POST   /auth/facebook-login                       # Facebook OAuth
POST   /auth/facebook-callback                    # OAuth callback
```

### New Endpoints (Shop/Loyalty)

```
POST   /saloon/promotion                          # Create promotion
PUT    /saloon/promotion/{id}                     # Update promotion
DELETE /saloon/promotion/{id}                     # Delete promotion
GET    /saloon/feed                               # Shop list with loyalty
```

---

## Implementation Roadmap

### Phase 1: CRITICAL (Deposit & Payment System) - Estimate: 4-5 weeks

1. Database schema updates for deposits
2. Deposit payment option logic
3. Remaining balance tracking
4. Escrow integration
5. Cancellation policy enforcement
6. No-show protection

### Phase 2: CRITICAL (User Safety) - Estimate: 2-3 weeks

1. User blocking system
2. Blocking enforcement middleware
3. Generic reporting system
4. Report admin workflow

### Phase 3: HIGH (Authentication & Profiles) - Estimate: 3-4 weeks

1. Facebook authentication
2. Customer profile with portfolio
3. Profile privacy control
4. Barber type distinction

### Phase 4: MEDIUM-HIGH (Polish & Integration) - Estimate: 2-3 weeks

1. Notification profile pictures
2. Shop tile loyalty/discount display
3. QR code booking integration

---

## Risk Assessment

### High Risk

- Deposit & escrow system (financial risk, compliance)
- Payment collection workflow (transaction integrity)
- User blocking (could break relationships)

### Medium Risk

- Authentication integration (third-party dependency)
- Profile portfolio (storage/CDN)
- Notification profile pictures (image loading performance)

### Low Risk

- Reporting system (isolated feature)
- Barber type distinction (backwards compatible)
- Loyalty display (UI/cosmetic)

---

## Testing Requirements

### Unit Tests Needed

- Deposit calculation logic
- Escrow state transitions
- Blocking authorization checks
- Report validation
- Refund calculations

### Integration Tests Needed

- End-to-end booking with deposit
- Payment collection workflow
- Blocking enforcement across modules
- Authentication flow with Facebook

### Manual Testing Needed

- Payment collection UI workflow
- Blocking user experience
- Notification display with images
- Customer profile access control

---

End of Analysis Document
