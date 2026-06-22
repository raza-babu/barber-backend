# 🚀 Comprehensive Task List - Missing Features Implementation
## Barber Booking Platform Backend

**Document Version:** 1.0  
**Last Updated:** 2026-06-16  
**Total Tasks:** 89  
**Total Estimated Hours:** ~260-320 hours (~6-8 weeks)  

---

## 📋 Table of Contents
1. [Phase 1: CRITICAL - Deposit & Payment System](#phase-1-critical---deposit--payment-system)
2. [Phase 2: CRITICAL - User Safety (Blocking & Reporting)](#phase-2-critical---user-safety-blocking--reporting)
3. [Phase 3: HIGH - Authentication & Profiles](#phase-3-high---authentication--profiles)
4. [Phase 4: MEDIUM-HIGH - Polish & Integration](#phase-4-medium-high---polish--integration)

---

## PHASE 1: CRITICAL - Deposit & Payment System
**Priority:** 🔴 CRITICAL  
**Estimated Duration:** 4-5 weeks  
**Estimated Hours:** 140-170 hours  

### 🏦 BOOKING MODULE - Deposit Features

#### Task 1.1: Database - Add Deposit Fields to Booking Model
- **Status:** ⬜ Not Started
- **Estimated Time:** 2-3 hours
- **Description:** Update Prisma Booking model with deposit-related fields
- **Files to Modify:**
  - `prisma/schema/models/Booking.prisma`
- **Changes Required:**
  ```prisma
  model Booking {
    // ... existing fields ...
    
    // Deposit fields
    depositAmount          Float?
    remainingBalance       Float?
    paymentType            String? // "DEPOSIT" | "FULL"
    depositPaidAt          DateTime?
    remainingBalancePaidAt DateTime?
    
    // Cancellation fields
    cancellationReason     String?
    cancellationTime       DateTime?
    refundAmount           Float?
    refundProcessedAt      DateTime?
    
    // Payment status tracking
    paymentStatus          String? // "UNPAID" | "DEPOSIT_PAID" | "FULLY_PAID" | "REFUNDED"
  }
  ```
- **Dependencies:** None
- **Acceptance Criteria:**
  - Prisma schema validates
  - Migration created
  - Generated Prisma client updated

#### Task 1.2: Database - Create Deposit Policy Model
- **Status:** ⬜ Not Started
- **Estimated Time:** 2-3 hours
- **Description:** Create model for shop owner deposit configuration
- **Files to Create:**
  - `prisma/schema/models/DepositPolicy.prisma`
- **Changes Required:**
  ```prisma
  model DepositPolicy {
    id                    String   @id @default(auto()) @map("_id") @db.ObjectId
    saloonOwnerId         String   @unique @db.ObjectId
    
    // Deposit configuration
    depositAmount         Float    // Fixed amount in £
    depositPercentage     Float?   // Percentage of service price (alternative to fixed)
    usePercentage         Boolean  @default(false)
    
    // Cancellation policy
    cancellationWindowHours Int     @default(24) // Hours before appointment
    refundPercentageOnCancel Float  @default(100) // 100 = full refund
    forfeitsDepositAfter    Boolean @default(true)
    
    // Configuration
    acceptedPaymentMethods  String[] // ["CARD", "CASH", "ONLINE"]
    enabled                 Boolean  @default(true)
    
    // Metadata
    createdAt             DateTime @default(now())
    updatedAt             DateTime @updatedAt
    
    // Relationships
    saloonOwner           SaloonOwner @relation(fields: [saloonOwnerId], references: [userId])
    
    @@map("deposit_policies")
  }
  ```
- **Dependencies:** Task 1.1
- **Acceptance Criteria:**
  - Model created and validated
  - Relationship to SaloonOwner established
  - Migration created

#### Task 1.3: Database - Update SaloonOwner Model
- **Status:** ⬜ Not Started
- **Estimated Time:** 1-2 hours
- **Description:** Add relationship to DepositPolicy in SaloonOwner
- **Files to Modify:**
  - `prisma/schema/models/SaloonOwner.prisma`
- **Changes Required:**
  ```prisma
  model SaloonOwner {
    // ... existing fields ...
    depositPolicy    DepositPolicy?
    // ... rest of model ...
  }
  ```
- **Dependencies:** Task 1.2
- **Acceptance Criteria:**
  - Relationship created and bidirectional
  - Migration runs successfully

#### Task 1.4: Database - Update Payment Model
- **Status:** ⬜ Not Started
- **Estimated Time:** 2-3 hours
- **Description:** Add fields for tracking payment stages
- **Files to Modify:**
  - `prisma/schema/models/Payment .prisma`
- **Changes Required:**
  ```prisma
  model Payment {
    // ... existing fields ...
    
    // Payment stage tracking
    paymentStage          String? // "DEPOSIT" | "REMAINING_BALANCE" | "FULL"
    depositAmount         Float?
    remainingAmount       Float?
    collectionMethod      String? // "CASH" | "CARD" | "ONLINE" | "ALREADY_PAID"
    collectedAt           DateTime?
    
    // Escrow tracking
    escrowStatus          String? // "HELD" | "RELEASED" | "FORFEITED"
    escrowReleasedAt      DateTime?
    escrowForfeitReason   String?
    
    // ... rest of model ...
  }
  ```
- **Dependencies:** Task 1.1
- **Acceptance Criteria:**
  - Payment model updated
  - Migration created
  - Schema validates

#### Task 1.5: API Validation - Create Deposit Payment Schemas
- **Status:** ⬜ Not Started
- **Estimated Time:** 2-3 hours
- **Description:** Create Zod schemas for deposit payment endpoints
- **Files to Create/Modify:**
  - `src/app/modules/booking/booking.validation.ts`
- **Changes Required:**
  - Add schema for deposit payment selection
  - Add schema for payment type choice
  - Add schema for remaining balance collection
- **Acceptance Criteria:**
  - All schemas validate correctly
  - TypeScript types properly inferred

#### Task 1.6: Service Logic - Implement Deposit Payment Calculation
- **Status:** ⬜ Not Started
- **Estimated Time:** 4-5 hours
- **Description:** Service layer logic to calculate and offer deposit vs full payment
- **Files to Create:**
  - `src/app/modules/booking/booking.deposit.service.ts` (new helper)
- **Methods to Implement:**
  ```typescript
  - calculateDepositAmount(servicePrice: number, policy: DepositPolicy): number
  - calculateRemainingBalance(totalPrice: number, depositPaid: number): number
  - generatePaymentOptions(booking: Booking, policy: DepositPolicy): {depositOption, fullOption}
  - validateDepositPaymentType(paymentType: string): boolean
  ```
- **Dependencies:** Task 1.2, 1.4, 1.5
- **Acceptance Criteria:**
  - All methods implemented and tested
  - Calculations verified with examples
  - Error handling for edge cases

#### Task 1.7: Controller - Add Deposit Payment Endpoints
- **Status:** ⬜ Not Started
- **Estimated Time:** 4-5 hours
- **Description:** Create booking endpoints for deposit payment workflow
- **Files to Modify:**
  - `src/app/modules/booking/booking.controller.ts`
  - `src/app/modules/booking/booking.routes.ts`
- **Endpoints to Add:**
  ```
  POST   /booking/payment-options/:bookingId    # Get deposit vs full options
  POST   /booking/create-deposit-booking        # Create with deposit choice
  GET    /booking/{id}/payment-summary          # View payment breakdown
  POST   /booking/{id}/collect-remaining-balance # Record remaining payment
  ```
- **Dependencies:** Task 1.6, 1.5
- **Acceptance Criteria:**
  - All endpoints tested with Postman/Insomnia
  - Proper error handling
  - Response validation

#### Task 1.8: Service Logic - Implement Cancellation with Deposit Refund
- **Status:** ⬜ Not Started
- **Estimated Time:** 5-6 hours
- **Description:** Implement cancellation logic that checks window and applies forfeit
- **Files to Modify:**
  - `src/app/modules/booking/booking.service.ts`
- **Methods to Implement:**
  ```typescript
  - calculateRefundAmount(booking: Booking, policy: DepositPolicy): {refundable, forfeited}
  - checkCancellationWindow(booking: Booking, policy: DepositPolicy): {allowed, hoursRemaining}
  - processCancellation(bookingId: string, reason?: string): Promise<{refund}>
  - validateCancellationEligibility(booking: Booking): boolean
  ```
- **Dependencies:** Task 1.1, 1.2, 1.6
- **Acceptance Criteria:**
  - Cancellation window enforced correctly
  - Refund amounts calculated properly
  - No-show flagged when within cancellation period

#### Task 1.9: Service Logic - Implement No-Show Deposit Forfeiture
- **Status:** ⬜ Not Started
- **Estimated Time:** 3-4 hours
- **Description:** Auto-forfeit deposit when booking marked as NO_SHOW
- **Files to Modify:**
  - `src/app/modules/booking/booking.service.ts`
- **Methods to Implement:**
  ```typescript
  - markNoShow(bookingId: string): Promise<{forfeited}>
  - forfeitDeposit(bookingId: string, reason: string): Promise<void>
  - releaseDepositForfeiture(bookingId: string): Promise<void> // Admin override
  ```
- **Dependencies:** Task 1.1, 1.8
- **Acceptance Criteria:**
  - Deposit automatically forfeited on NO_SHOW
  - Admin can override forfeiture
  - Proper logging of forfeiture reason

#### Task 1.10: Service Logic - Remaining Balance Collection Workflow
- **Status:** ⬜ Not Started
- **Estimated Time:** 6-7 hours
- **Description:** Implement workflow for collecting remaining balance at shop
- **Files to Create:**
  - `src/app/modules/booking/booking.remainingBalance.service.ts` (new helper)
- **Methods to Implement:**
  ```typescript
  - initializeRemainingBalanceCollection(bookingId: string): Promise<{summary}>
  - recordRemainingBalancePayment(
      bookingId: string,
      amount: number,
      method: "CASH" | "CARD" | "ONLINE" | "ALREADY_PAID",
      notes?: string
    ): Promise<void>
  - completeBookingPayment(bookingId: string): Promise<void>
  - generatePaymentSummary(bookingId: string): Promise<{breakdown}>
  ```
- **Dependencies:** Task 1.1, 1.4, 1.6
- **Acceptance Criteria:**
  - Remaining balance tracked accurately
  - Multiple payment methods supported
  - Payment status transitions correctly

#### Task 1.11: Controller - Add Remaining Balance Collection Endpoints
- **Status:** ⬜ Not Started
- **Estimated Time:** 4-5 hours
- **Description:** Create endpoints for owner to collect remaining balance
- **Files to Modify:**
  - `src/app/modules/booking/booking.controller.ts`
  - `src/app/modules/booking/booking.routes.ts`
- **Endpoints to Add:**
  ```
  GET    /booking/{id}/remaining-balance        # View what's owed
  POST   /booking/{id}/record-payment           # Record payment received
  PUT    /booking/{id}/confirm-payment          # Finalize payment
  GET    /booking/pending-payments              # List unpaid bookings
  ```
- **Dependencies:** Task 1.10, 1.11
- **Acceptance Criteria:**
  - Endpoints return correct data format
  - Only saloon owner can access
  - Proper validation of payment amounts

#### Task 1.12: Service - Shop Owner Deposit Policy Management
- **Status:** ⬜ Not Started
- **Estimated Time:** 4-5 hours
- **Description:** CRUD operations for deposit policy configuration
- **Files to Create:**
  - `src/app/modules/depositPolicy/depositPolicy.service.ts`
  - `src/app/modules/depositPolicy/depositPolicy.controller.ts`
  - `src/app/modules/depositPolicy/depositPolicy.routes.ts`
  - `src/app/modules/depositPolicy/depositPolicy.validation.ts`
- **Methods to Implement:**
  ```typescript
  - createDepositPolicy(saloonOwnerId: string, config: DepositPolicyInput)
  - getDepositPolicy(saloonOwnerId: string)
  - updateDepositPolicy(saloonOwnerId: string, config: DepositPolicyUpdate)
  - deleteDepositPolicy(saloonOwnerId: string)
  - validateDepositConfig(config: DepositPolicyInput): boolean
  ```
- **Dependencies:** Task 1.2, 1.3
- **Acceptance Criteria:**
  - All CRUD operations work
  - Validation prevents invalid configs
  - Saloon owner can update anytime

#### Task 1.13: Controller - Register Deposit Policy Routes
- **Status:** ⬜ Not Started
- **Estimated Time:** 2-3 hours
- **Description:** Add deposit policy routes to main app
- **Files to Modify:**
  - `src/app.ts`
- **Routes to Add:**
  ```
  POST   /deposit-policy          # Create
  GET    /deposit-policy          # Get
  PUT    /deposit-policy          # Update
  DELETE /deposit-policy          # Delete
  ```
- **Dependencies:** Task 1.12
- **Acceptance Criteria:**
  - Routes accessible
  - Auth middleware working
  - Proper error responses

---

### 💳 PAYMENT MODULE - Deposit & Escrow

#### Task 1.14: Service Logic - Implement Escrow Hold System
- **Status:** ⬜ Not Started
- **Estimated Time:** 5-6 hours
- **Description:** Logic to hold payment in escrow until appointment completion
- **Files to Create:**
  - `src/app/modules/payment/payment.escrow.service.ts` (new helper)
- **Methods to Implement:**
  ```typescript
  - holdPaymentInEscrow(paymentId: string, bookingId: string): Promise<void>
  - releaseEscrow(bookingId: string, reason: "COMPLETED" | "NO_SHOW"): Promise<void>
  - forfeitEscrow(bookingId: string): Promise<void>
  - getEscrowStatus(paymentId: string): Promise<EscrowStatus>
  - validateEscrowEligibility(booking: Booking): boolean
  ```
- **Dependencies:** Task 1.1, 1.4, 1.6
- **Acceptance Criteria:**
  - Escrow status tracked in database
  - Release logic tied to appointment completion
  - Proper audit trail maintained

#### Task 1.15: Service Logic - Deposit Amount Processing
- **Status:** ⬜ Not Started
- **Estimated Time:** 4-5 hours
- **Description:** Modify payment processing to handle deposit amounts
- **Files to Modify:**
  - `src/app/modules/payment/payment.service.ts`
  - `src/app/modules/payment/payment.controller.ts`
- **Methods to Implement:**
  ```typescript
  - processDepositPayment(bookingId: string, customerId: string): Promise<PaymentIntent>
  - calculatePaymentAmount(booking: Booking, isDeposit: boolean): number
  - validatePaymentAmount(booking: Booking, amount: number): boolean
  ```
- **Dependencies:** Task 1.6, 1.14
- **Acceptance Criteria:**
  - Only deposit amount charged when deposit selected
  - Proper Stripe integration for deposit
  - Error handling for amount mismatches

#### Task 1.16: Service Logic - Refund Processing with Cancellation Policy
- **Status:** ⬜ Not Started
- **Estimated Time:** 5-6 hours
- **Description:** Enhanced refund logic considering cancellation window
- **Files to Modify:**
  - `src/app/modules/payment/payment.service.ts`
- **Methods to Implement:**
  ```typescript
  - processRefund(bookingId: string, reason: string): Promise<{refunded, forfeited}>
  - calculateRefundAmount(booking: Booking, policy: DepositPolicy): {amount, reason}
  - verifyRefundEligibility(booking: Booking, policy: DepositPolicy): boolean
  - applyRefundPolicy(booking: Booking, policy: DepositPolicy): Promise<void>
  ```
- **Dependencies:** Task 1.8, 1.2
- **Acceptance Criteria:**
  - Refunds calculated correctly based on policy
  - Stripe refunds processed
  - Booking status updated

#### Task 1.17: Controller - Add Remaining Balance Payment Endpoints
- **Status:** ⬜ Not Started
- **Estimated Time:** 4-5 hours
- **Description:** Endpoints for processing remaining balance payment
- **Files to Modify:**
  - `src/app/modules/payment/payment.controller.ts`
  - `src/app/modules/payment/payment.routes.ts`
- **Endpoints to Add:**
  ```
  POST   /payment/remaining-balance        # Process remaining balance
  POST   /payment/record-cash-payment      # Record cash payment
  POST   /payment/confirm-appointment-payment # Finalize payment
  GET    /payment/booking/{bookingId}/status
  ```
- **Dependencies:** Task 1.10, 1.15
- **Acceptance Criteria:**
  - All endpoints working
  - Proper Stripe handling
  - Payment status transitions correct

#### Task 1.18: Integration - Update Booking Completion Workflow
- **Status:** ⬜ Not Started
- **Estimated Time:** 4-5 hours
- **Description:** Tie escrow release to appointment completion
- **Files to Modify:**
  - `src/app/modules/booking/booking.service.ts`
- **Methods to Modify:**
  - updateBookingStatus (add escrow release on COMPLETED)
- **Dependencies:** Task 1.14, 1.8
- **Acceptance Criteria:**
  - Escrow automatically released when booking marked COMPLETED
  - Proper payment reconciliation
  - No manual intervention needed

#### Task 1.19: Testing - Payment & Deposit Unit Tests
- **Status:** ⬜ Not Started
- **Estimated Time:** 6-8 hours
- **Description:** Comprehensive unit tests for deposit and payment logic
- **Files to Create:**
  - `src/app/modules/booking/booking.deposit.test.ts`
  - `src/app/modules/payment/payment.escrow.test.ts`
  - `src/app/modules/payment/payment.refund.test.ts`
- **Test Cases:**
  - Deposit calculation with fixed amount
  - Deposit calculation with percentage
  - Cancellation window enforcement
  - Refund calculation scenarios
  - No-show forfeiture
  - Escrow hold and release
- **Dependencies:** Task 1.6-1.17
- **Acceptance Criteria:**
  - All critical paths tested
  - Edge cases covered
  - >80% code coverage

#### Task 1.20: Testing - Payment & Deposit Integration Tests
- **Status:** ⬜ Not Started
- **Estimated Time:** 6-8 hours
- **Description:** Integration tests for end-to-end deposit workflow
- **Files to Create:**
  - `src/app/modules/booking/booking.integration.test.ts`
- **Test Cases:**
  - Full booking with deposit option
  - Booking with remaining balance collection
  - Cancellation with refund
  - No-show with forfeiture
  - Multiple payment methods
- **Dependencies:** Task 1.6-1.17
- **Acceptance Criteria:**
  - E2E flows tested
  - Real Stripe sandbox used
  - All scenarios pass

---

## PHASE 2: CRITICAL - User Safety (Blocking & Reporting)
**Priority:** 🔴 CRITICAL  
**Estimated Duration:** 2-3 weeks  
**Estimated Hours:** 70-90 hours  

### 🚫 USER BLOCKING MODULE

#### Task 2.1: Database - Create User Block Model
- **Status:** ⬜ Not Started
- **Estimated Time:** 2-3 hours
- **Description:** Create model for user blocking relationships
- **Files to Create:**
  - `prisma/schema/models/UserBlock.prisma`
- **Changes Required:**
  ```prisma
  model UserBlock {
    id            String   @id @default(auto()) @map("_id") @db.ObjectId
    blockerId     String   @db.ObjectId
    blockedUserId String   @db.ObjectId
    reason        String?  // Optional reason for blocking
    blockedAt     DateTime @default(now())
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt
    
    // Relationships
    blocker       User     @relation("BlockerUser", fields: [blockerId], references: [id])
    blockedUser   User     @relation("BlockedUser", fields: [blockedUserId], references: [id])
    
    // Ensure no duplicate blocks
    @@unique([blockerId, blockedUserId])
    @@map("user_blocks")
  }
  ```
- **Dependencies:** None
- **Acceptance Criteria:**
  - Model created and validates
  - Unique constraint prevents duplicates
  - Migration created

#### Task 2.2: Database - Update User Model with Block Relations
- **Status:** ⬜ Not Started
- **Estimated Time:** 1-2 hours
- **Description:** Add relationships to UserBlock model
- **Files to Modify:**
  - `prisma/schema/models/User.prisma`
- **Changes Required:**
  ```prisma
  model User {
    // ... existing fields ...
    
    // Blocking relationships
    blockedUsers    UserBlock[] @relation("BlockerUser")
    blockedByUsers  UserBlock[] @relation("BlockedUser")
  }
  ```
- **Dependencies:** Task 2.1
- **Acceptance Criteria:**
  - Relations created bidirectionally
  - Migration runs successfully

#### Task 2.3: Service - User Blocking Operations
- **Status:** ⬜ Not Started
- **Estimated Time:** 4-5 hours
- **Description:** Service layer for blocking/unblocking users
- **Files to Create:**
  - `src/app/modules/userBlock/userBlock.service.ts`
- **Methods to Implement:**
  ```typescript
  - blockUser(blockerId: string, blockedUserId: string, reason?: string): Promise<void>
  - unblockUser(blockerId: string, blockedUserId: string): Promise<void>
  - getBlockedUsers(userId: string): Promise<User[]>
  - getBlockingUsers(userId: string): Promise<User[]>
  - isUserBlocked(blockerId: string, blockedUserId: string): Promise<boolean>
  - validateBlockingAction(blockerId: string, blockedUserId: string): boolean
  ```
- **Dependencies:** Task 2.1, 2.2
- **Acceptance Criteria:**
  - All methods implemented
  - Proper error handling
  - Self-blocking prevented

#### Task 2.4: Controller & Routes - Blocking Endpoints
- **Status:** ⬜ Not Started
- **Estimated Time:** 3-4 hours
- **Description:** API endpoints for blocking management
- **Files to Create:**
  - `src/app/modules/userBlock/userBlock.controller.ts`
  - `src/app/modules/userBlock/userBlock.routes.ts`
  - `src/app/modules/userBlock/userBlock.validation.ts`
- **Endpoints to Add:**
  ```
  POST   /user/block/{userId}          # Block user
  DELETE /user/block/{userId}          # Unblock user
  GET    /user/blocked-list            # View users I blocked
  GET    /user/blocking-list           # View users blocking me
  ```
- **Dependencies:** Task 2.3
- **Acceptance Criteria:**
  - All endpoints working
  - Proper auth required
  - Response validation

#### Task 2.5: Middleware - Blocking Authorization Check
- **Status:** ⬜ Not Started
- **Estimated Time:** 3-4 hours
- **Description:** Middleware to prevent interactions with blocked users
- **Files to Create:**
  - `src/app/middlewares/checkBlockingStatus.ts`
- **Implementation:**
  - Check if users are blocking each other
  - Prevent messaging if blocked
  - Prevent booking if blocked
  - Prevent queue access if blocked
  - Prevent profile access if blocked
- **Dependencies:** Task 2.3
- **Acceptance Criteria:**
  - Middleware prevents all interactions
  - Proper error messages
  - Performance optimized

#### Task 2.6: Integration - Apply Blocking Check to Messaging
- **Status:** ⬜ Not Started
- **Estimated Time:** 2-3 hours
- **Description:** Integrate blocking check into messaging module
- **Files to Modify:**
  - `src/app/modules/chat/chat.routes.ts` (or similar)
  - `src/app/utils/socketio.ts` (if using WebSockets)
- **Changes:**
  - Add blocking check to sendMessage
  - Prevent conversation access if blocked
  - Remove existing conversations if newly blocked
- **Dependencies:** Task 2.5
- **Acceptance Criteria:**
  - Can't message blocked users
  - Existing messages remain but hidden
  - Proper error on attempt

#### Task 2.7: Integration - Apply Blocking Check to Booking
- **Status:** ⬜ Not Started
- **Estimated Time:** 2-3 hours
- **Description:** Integrate blocking check into booking module
- **Files to Modify:**
  - `src/app/modules/booking/booking.routes.ts`
  - `src/app/modules/booking/booking.service.ts`
- **Changes:**
  - Prevent booking with blocked barber
  - Prevent booking with shop of blocked owner
  - Show error to customer
- **Dependencies:** Task 2.5
- **Acceptance Criteria:**
  - Can't book with blocked users
  - Clear error message
  - Barber can't be selected if blocked

#### Task 2.8: Integration - Apply Blocking Check to Queue
- **Status:** ⬜ Not Started
- **Estimated Time:** 2-3 hours
- **Description:** Integrate blocking check into queue module
- **Files to Modify:**
  - `src/app/modules/queue/queue.routes.ts` (or similar)
  - Queue related services
- **Changes:**
  - Prevent queue join if blocked
  - Remove from queue if newly blocked
  - Prevent barber access if blocked
- **Dependencies:** Task 2.5
- **Acceptance Criteria:**
  - Can't join queue of blocked shop
  - Barber sees appropriate message
  - No queue history visible

#### Task 2.9: Integration - Apply Blocking Check to Profile Access
- **Status:** ⬜ Not Started
- **Estimated Time:** 2-3 hours
- **Description:** Prevent viewing blocked user profiles
- **Files to Modify:**
  - `src/app/modules/user/user.routes.ts`
  - `src/app/modules/customer/customer.routes.ts` (if exists)
- **Changes:**
  - Return 403 when viewing blocked user
  - Hide profile data from blocked users
- **Dependencies:** Task 2.5
- **Acceptance Criteria:**
  - Can't access blocked user profile
  - Returns appropriate error
  - No data leakage

#### Task 2.10: Testing - User Blocking Tests
- **Status:** ⬜ Not Started
- **Estimated Time:** 4-5 hours
- **Description:** Comprehensive tests for blocking functionality
- **Files to Create:**
  - `src/app/modules/userBlock/userBlock.test.ts`
- **Test Cases:**
  - Block user successfully
  - Unblock user
  - Self-blocking prevention
  - Can't book blocked user
  - Can't message blocked user
  - Can't access blocked profile
  - Queue prevention
- **Dependencies:** Task 2.3-2.9
- **Acceptance Criteria:**
  - All scenarios tested
  - Edge cases covered
  - >85% code coverage

---

### 📋 REPORTING MODULE

#### Task 2.11: Database - Create Generic User Report Model
- **Status:** ⬜ Not Started
- **Estimated Time:** 2-3 hours
- **Description:** Create model for reporting any user
- **Files to Create:**
  - `prisma/schema/models/UserReport.prisma`
- **Changes Required:**
  ```prisma
  model UserReport {
    id              String   @id @default(auto()) @map("_id") @db.ObjectId
    reporterId      String   @db.ObjectId
    reportedUserId  String   @db.ObjectId
    reportCategory  String   // enum in code: HARASSMENT, FRAUD, INAPPROPRIATE, FAKE, COMPLAINT, OTHER
    description     String
    evidence        String[]? // URLs to images/videos
    status          String   @default("PENDING") // PENDING, INVESTIGATING, RESOLVED, DISMISSED
    adminNotes      String?
    resolvedBy      String?  @db.ObjectId // Admin who resolved
    resolutionNotes String?
    createdAt       DateTime @default(now())
    updatedAt       DateTime @updatedAt
    
    // Relationships
    reporter        User     @relation("ReporterUser", fields: [reporterId], references: [id])
    reportedUser    User     @relation("ReportedUser", fields: [reportedUserId], references: [id])
    admin           User?    @relation("ResolverUser", fields: [resolvedBy], references: [id])
    
    @@map("user_reports")
  }
  ```
- **Dependencies:** None
- **Acceptance Criteria:**
  - Model created
  - Enums properly defined
  - Migration created

#### Task 2.12: Database - Update User Model with Report Relations
- **Status:** ⬜ Not Started
- **Estimated Time:** 1-2 hours
- **Description:** Add relationships to UserReport
- **Files to Modify:**
  - `prisma/schema/models/User.prisma`
- **Changes:**
  ```prisma
  model User {
    // ... existing fields ...
    reportsSubmitted    UserReport[] @relation("ReporterUser")
    reportsAgainst      UserReport[] @relation("ReportedUser")
    reportsResolved     UserReport[] @relation("ResolverUser")
  }
  ```
- **Dependencies:** Task 2.11
- **Acceptance Criteria:**
  - All relations bidirectional
  - Migration successful

#### Task 2.13: Enum - Create Report Categories
- **Status:** ⬜ Not Started
- **Estimated Time:** 1 hour
- **Description:** Create ReportCategory enum
- **Files to Create:**
  - `prisma/schema/enums/ReportCategory.prisma`
- **Categories:**
  - HARASSMENT
  - FRAUD
  - INAPPROPRIATE_BEHAVIOR
  - FAKE_ACCOUNT
  - SERVICE_COMPLAINT
  - SCAM
  - OTHER
- **Dependencies:** None
- **Acceptance Criteria:**
  - Enum properly defined
  - Used in UserReport model

#### Task 2.14: Service - Report Management
- **Status:** ⬜ Not Started
- **Estimated Time:** 5-6 hours
- **Description:** Service for creating and managing reports
- **Files to Create:**
  - `src/app/modules/userReport/userReport.service.ts`
- **Methods to Implement:**
  ```typescript
  - submitReport(reporterId: string, data: ReportInput): Promise<UserReport>
  - getReportDetails(reportId: string): Promise<UserReport>
  - getReportsAgainstUser(userId: string): Promise<UserReport[]> // Admin
  - getReportsByReporter(reporterId: string): Promise<UserReport[]> // Own reports
  - updateReportStatus(reportId: string, status: string, notes?: string): Promise<void> // Admin
  - searchReports(filters: ReportFilters): Promise<UserReport[]> // Admin
  - validateReport(data: ReportInput): boolean
  - isDuplicateReport(reporterId: string, reportedUserId: string): Promise<boolean>
  ```
- **Dependencies:** Task 2.11, 2.12, 2.13
- **Acceptance Criteria:**
  - All methods implemented
  - Validation working
  - Duplicate detection working

#### Task 2.15: Controller & Routes - Report Endpoints
- **Status:** ⬜ Not Started
- **Estimated Time:** 3-4 hours
- **Description:** API endpoints for reporting
- **Files to Create:**
  - `src/app/modules/userReport/userReport.controller.ts`
  - `src/app/modules/userReport/userReport.routes.ts`
  - `src/app/modules/userReport/userReport.validation.ts`
- **Endpoints to Add:**
  ```
  POST   /report/submit              # Submit report (authenticated)
  GET    /report/{reportId}          # View report (admin/reporter)
  GET    /reports                    # List reports (admin)
  PUT    /report/{reportId}/status   # Update status (admin)
  GET    /report/against-me          # Reports against me (admin view)
  ```
- **Dependencies:** Task 2.14
- **Acceptance Criteria:**
  - All endpoints working
  - Proper auth checks
  - Response validation

#### Task 2.16: Service - Admin Report Workflow
- **Status:** ⬜ Not Started
- **Estimated Time:** 4-5 hours
- **Description:** Service for admin to manage reports
- **Files to Modify:**
  - `src/app/modules/userReport/userReport.service.ts`
- **Methods to Implement:**
  ```typescript
  - markAsInvestigating(reportId: string, adminId: string): Promise<void>
  - resolveReport(reportId: string, adminId: string, resolution: string, notes: string): Promise<void>
  - dismissReport(reportId: string, adminId: string, reason: string): Promise<void>
  - escalateReport(reportId: string, severity: string): Promise<void>
  - getReportStats(filters?: DateRange): Promise<{total, pending, resolved}>
  - getHighPriorityReports(): Promise<UserReport[]>
  ```
- **Dependencies:** Task 2.14
- **Acceptance Criteria:**
  - All admin operations working
  - Proper logging
  - Audit trail maintained

#### Task 2.17: Notification - Admin Report Alerts
- **Status:** ⬜ Not Started
- **Estimated Time:** 3-4 hours
- **Description:** Notify admins of new reports
- **Files to Modify:**
  - `src/app/modules/userReport/userReport.service.ts`
  - `src/app/modules/notification/notification.service.ts`
- **Implementation:**
  - Send notification on report submission
  - Daily summary for unresolved reports
  - Alert for high-severity categories
- **Dependencies:** Task 2.14, Task 2.16
- **Acceptance Criteria:**
  - Admin receives notifications
  - Notifications contain key details
  - No alert fatigue

#### Task 2.18: Testing - Report System Tests
- **Status:** ⬜ Not Started
- **Estimated Time:** 4-5 hours
- **Description:** Tests for reporting functionality
- **Files to Create:**
  - `src/app/modules/userReport/userReport.test.ts`
- **Test Cases:**
  - Submit report successfully
  - Duplicate report prevention
  - Admin workflow
  - Status transitions
  - Notifications sent
  - Access control
- **Dependencies:** Task 2.14-2.17
- **Acceptance Criteria:**
  - All flows tested
  - >80% coverage
  - Edge cases handled

---

## PHASE 3: HIGH - Authentication & Profiles
**Priority:** 🟡 HIGH  
**Estimated Duration:** 3-4 weeks  
**Estimated Hours:** 90-120 hours  

### 🔐 AUTHENTICATION MODULE - Facebook

#### Task 3.1: Database - Update PlatFormType Enum
- **Status:** ⬜ Not Started
- **Estimated Time:** 1 hour
- **Description:** Add FACEBOOK to authentication platforms
- **Files to Modify:**
  - `prisma/schema/enums/PlatFormType.prisma`
- **Changes:**
  ```prisma
  enum PlatFormType {
    GOOGLE
    FACEBOOK
    APPLE
  }
  ```
- **Dependencies:** None
- **Acceptance Criteria:**
  - Enum updated
  - Migration created

#### Task 3.2: Database - Add Facebook Fields to User Model
- **Status:** ⬜ Not Started
- **Estimated Time:** 1-2 hours
- **Description:** Add Facebook ID and token fields
- **Files to Modify:**
  - `prisma/schema/models/User.prisma`
- **Changes:**
  ```prisma
  model User {
    // ... existing fields ...
    facebookId           String?
    facebookAccessToken  String?
    facebookRefreshToken String?
    
    // ... rest of model ...
  }
  ```
- **Dependencies:** Task 3.1
- **Acceptance Criteria:**
  - Fields added
  - Migration successful

#### Task 3.3: Setup - Facebook App Configuration
- **Status:** ⬜ Not Started
- **Estimated Time:** 2-3 hours
- **Description:** Create Facebook App and configure OAuth
- **Process:**
  1. Create Facebook Developer App
  2. Generate App ID and Secret
  3. Configure OAuth Redirect URIs
  4. Add to environment variables
  5. Test OAuth flow
- **Files to Modify:**
  - `.env.example`
  - `README.md` (documentation)
- **Acceptance Criteria:**
  - Facebook App created
  - Credentials in environment
  - OAuth flow tested manually

#### Task 3.4: Service - Facebook OAuth Implementation
- **Status:** ⬜ Not Started
- **Estimated Time:** 5-6 hours
- **Description:** Service to handle Facebook authentication
- **Files to Create:**
  - `src/app/modules/auth/auth.facebook.service.ts`
- **Methods to Implement:**
  ```typescript
  - getFacebookAuthURL(): string
  - verifyFacebookToken(token: string): Promise<{valid, userData}>
  - exchangeCodeForToken(code: string): Promise<{accessToken, refreshToken}>
  - getFacebookUserProfile(accessToken: string): Promise<FacebookUserData>
  - linkFacebookAccount(userId: string, facebookData: FacebookUserData): Promise<void>
  - unlinkFacebookAccount(userId: string): Promise<void>
  ```
- **Dependencies:** Task 3.2, 3.3
- **Acceptance Criteria:**
  - OAuth flow working
  - Token exchange successful
  - User data retrieval working

#### Task 3.5: Controller - Facebook Login Endpoint
- **Status:** ⬜ Not Started
- **Estimated Time:** 3-4 hours
- **Description:** Implement Facebook login endpoints
- **Files to Modify:**
  - `src/app/modules/auth/auth.controller.ts`
  - `src/app/modules/auth/auth.routes.ts`
- **Endpoints to Add:**
  ```
  POST   /auth/facebook-login       # Initiate Facebook login
  POST   /auth/facebook-callback    # Handle OAuth callback
  POST   /auth/facebook-link        # Link existing account
  DELETE /auth/facebook-unlink      # Unlink account
  ```
- **Dependencies:** Task 3.4
- **Acceptance Criteria:**
  - All endpoints working
  - Proper error handling
  - Session management correct

#### Task 3.6: Validation - Facebook Auth Schemas
- **Status:** ⬜ Not Started
- **Estimated Time:** 2 hours
- **Description:** Create Zod schemas for Facebook auth
- **Files to Modify:**
  - `src/app/modules/auth/auth.validation.ts`
- **Schemas:**
  - Facebook login payload
  - Facebook callback payload
  - Facebook link payload
- **Dependencies:** None
- **Acceptance Criteria:**
  - All schemas validate correctly
  - Proper error messages

#### Task 3.7: Frontend Integration Guide - Facebook OAuth
- **Status:** ⬜ Not Started
- **Estimated Time:** 2-3 hours
- **Description:** Document Facebook integration for frontend
- **Files to Create:**
  - `docs/FACEBOOK_AUTH_INTEGRATION.md`
- **Documentation:**
  - Facebook SDK setup
  - Login flow diagram
  - Error handling
  - Token refresh
  - Unlinking process
- **Dependencies:** Task 3.4, 3.5
- **Acceptance Criteria:**
  - Clear step-by-step guide
  - Code examples provided
  - Error scenarios documented

#### Task 3.8: Testing - Facebook Authentication Tests
- **Status:** ⬜ Not Started
- **Estimated Time:** 4-5 hours
- **Description:** Tests for Facebook auth flow
- **Files to Create:**
  - `src/app/modules/auth/auth.facebook.test.ts`
- **Test Cases:**
  - Facebook login successful
  - Invalid token handling
  - Token refresh
  - Account linking
  - Account unlinking
  - Duplicate account prevention
- **Dependencies:** Task 3.4, 3.5
- **Acceptance Criteria:**
  - All flows tested
  - Mock Facebook API
  - >80% coverage

---

### 👤 CUSTOMER PROFILE MODULE

#### Task 3.9: Database - Create Customer Profile Model
- **Status:** ⬜ Not Started
- **Estimated Time:** 2-3 hours
- **Description:** Create model for customer portfolio and preferences
- **Files to Create:**
  - `prisma/schema/models/CustomerProfile.prisma`
- **Changes Required:**
  ```prisma
  model CustomerProfile {
    id               String   @id @default(auto()) @map("_id") @db.ObjectId
    userId           String   @unique @db.ObjectId
    
    // Profile info
    bio              String?
    preferredBarberIds String[]? @db.ObjectId
    
    // Portfolio
    haircutPhotos    String[]? // Array of image URLs
    haircutVideos    String[]? // Array of video URLs
    
    // Preferences
    hairstyleNotes   String?
    preferredStyles  String[]?
    allergyNotes     String?
    
    // Privacy
    isProfilePublic  Boolean  @default(true)
    allowBarberComments Boolean @default(true)
    
    // Metadata
    createdAt        DateTime @default(now())
    updatedAt        DateTime @updatedAt
    
    // Relationships
    user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
    
    @@map("customer_profiles")
  }
  ```
- **Dependencies:** None
- **Acceptance Criteria:**
  - Model created and validated
  - User relationship established
  - Migration created

#### Task 3.10: Database - Add Relation to User Model
- **Status:** ⬜ Not Started
- **Estimated Time:** 1 hour
- **Description:** Add CustomerProfile relation to User
- **Files to Modify:**
  - `prisma/schema/models/User.prisma`
- **Changes:**
  ```prisma
  model User {
    // ... existing fields ...
    customerProfile    CustomerProfile?
    // ... rest of model ...
  }
  ```
- **Dependencies:** Task 3.9
- **Acceptance Criteria:**
  - Relation added
  - Migration successful

#### Task 3.11: Service - Customer Profile Operations
- **Status:** ⬜ Not Started
- **Estimated Time:** 5-6 hours
- **Description:** Service for managing customer profiles
- **Files to Create:**
  - `src/app/modules/customerProfile/customerProfile.service.ts`
- **Methods to Implement:**
  ```typescript
  - createProfile(userId: string, data: ProfileInput): Promise<CustomerProfile>
  - getProfile(userId: string): Promise<CustomerProfile>
  - updateProfile(userId: string, data: ProfileUpdate): Promise<CustomerProfile>
  - uploadHaircutPhoto(userId: string, file: File): Promise<{url}>
  - uploadHaircutVideo(userId: string, file: File): Promise<{url}>
  - deletePhoto(userId: string, photoUrl: string): Promise<void>
  - deleteVideo(userId: string, videoUrl: string): Promise<void>
  - updateHairstyleNotes(userId: string, notes: string): Promise<void>
  - updatePreferredBarbers(userId: string, barberIds: string[]): Promise<void>
  - getAccessibleProfile(requesterId: string, targetUserId: string): Promise<CustomerProfile | null>
  ```
- **Dependencies:** Task 3.9, 3.10
- **Acceptance Criteria:**
  - All methods implemented
  - Upload handling working
  - Privacy checks implemented

#### Task 3.12: Service - Profile Privacy & Access Control
- **Status:** ⬜ Not Started
- **Estimated Time:** 4-5 hours
- **Description:** Implement privacy rules for profile access
- **Files to Create/Modify:**
  - `src/app/modules/customerProfile/customerProfile.privacy.service.ts`
- **Methods to Implement:**
  ```typescript
  - canViewProfile(requesterId: string, targetUserId: string): Promise<boolean>
  - hasBookingOrQueue(requesterId: string, targetUserId: string): Promise<boolean>
  - applyAccessControl(profile: CustomerProfile, requesterId: string): CustomerProfile
  - getProfileAccessReason(requesterId: string, targetUserId: string): Promise<string>
  ```
- **Implementation Rules:**
  - Barber can view if booking/queue exists with customer
  - Customer can always view own profile
  - Shop owner can view their customer profiles
  - Public profiles visible to all (if enabled)
- **Dependencies:** Task 3.9, Task 3.11
- **Acceptance Criteria:**
  - Privacy rules enforced
  - No unauthorized access
  - Performance optimized

#### Task 3.13: Storage - Setup Image/Video Storage (CDN)
- **Status:** ⬜ Not Started
- **Estimated Time:** 3-4 hours
- **Description:** Configure storage for profile photos and videos
- **Options:** AWS S3, Firebase Storage, Cloudinary, etc.
- **Files to Create:**
  - `src/app/services/storage.service.ts`
- **Implementation:**
  - Upload handler
  - Delete handler
  - URL generation
  - Validation
- **Dependencies:** None
- **Acceptance Criteria:**
  - Storage integrated
  - Upload/delete working
  - URLs accessible

#### Task 3.14: Controller & Routes - Profile Endpoints
- **Status:** ⬜ Not Started
- **Estimated Time:** 4-5 hours
- **Description:** API endpoints for profile management
- **Files to Create:**
  - `src/app/modules/customerProfile/customerProfile.controller.ts`
  - `src/app/modules/customerProfile/customerProfile.routes.ts`
  - `src/app/modules/customerProfile/customerProfile.validation.ts`
- **Endpoints to Add:**
  ```
  GET    /customer/profile                    # Get own profile
  GET    /customer/{userId}/profile           # View others (with access check)
  PUT    /customer/profile                    # Update profile
  POST   /customer/profile/upload-photo       # Upload photo
  POST   /customer/profile/upload-video       # Upload video
  DELETE /customer/profile/photo/{photoId}    # Delete photo
  DELETE /customer/profile/video/{videoId}    # Delete video
  PUT    /customer/profile/preferences        # Update preferences
  PUT    /customer/profile/settings           # Update privacy settings
  ```
- **Dependencies:** Task 3.11, 3.12
- **Acceptance Criteria:**
  - All endpoints working
  - Proper auth checks
  - File upload working

#### Task 3.15: Barber Integration - View Customer Profile
- **Status:** ⬜ Not Started
- **Estimated Time:** 2-3 hours
- **Description:** Allow barbers to view customer profiles for appointments
- **Files to Modify:**
  - `src/app/modules/booking/booking.service.ts`
  - `src/app/modules/queue/queue.service.ts` (if exists)
- **Implementation:**
  - Include customer profile link in booking details
  - Check access before showing profile
  - Show helpful summary for appointment
- **Dependencies:** Task 3.12, 3.14
- **Acceptance Criteria:**
  - Barber can view customer profile for appointments
  - Privacy rules enforced
  - Relevant info displayed

#### Task 3.16: Testing - Customer Profile Tests
- **Status:** ⬜ Not Started
- **Estimated Time:** 5-6 hours
- **Description:** Comprehensive tests for profile management
- **Files to Create:**
  - `src/app/modules/customerProfile/customerProfile.test.ts`
  - `src/app/modules/customerProfile/customerProfile.privacy.test.ts`
- **Test Cases:**
  - Create profile
  - Upload photo/video
  - Update profile
  - Privacy rule enforcement
  - Barber access for booking
  - Public profile visibility
  - Access denied scenarios
- **Dependencies:** Task 3.11-3.15
- **Acceptance Criteria:**
  - All flows tested
  - >80% coverage
  - Edge cases handled

---

### 💼 BARBER MANAGEMENT MODULE

#### Task 3.17: Database - Update HiredBarber Model
- **Status:** ⬜ Not Started
- **Estimated Time:** 2 hours
- **Description:** Add permanent/temporary distinction to HiredBarber
- **Files to Modify:**
  - `prisma/schema/models/HiredBarber.prisma`
- **Changes:**
  ```prisma
  model HiredBarber {
    // ... existing fields ...
    barberType      String? // "PERMANENT" | "TEMPORARY"
    endDate         DateTime?
    status          String  @default("ACTIVE") // "ACTIVE" | "INACTIVE" | "ON_LEAVE"
    // ... rest of model ...
  }
  ```
- **Dependencies:** None
- **Acceptance Criteria:**
  - Model updated
  - Migration created

#### Task 3.18: Enum - Create Barber Type Enum
- **Status:** ⬜ Not Started
- **Estimated Time:** 1 hour
- **Description:** Create BarberType and BarberStatus enums
- **Files to Create:**
  - `prisma/schema/enums/BarberType.prisma`
  - `prisma/schema/enums/BarberStatus.prisma`
- **Enums:**
  ```
  BarberType: PERMANENT, TEMPORARY
  BarberStatus: ACTIVE, INACTIVE, ON_LEAVE, REMOVED
  ```
- **Dependencies:** None
- **Acceptance Criteria:**
  - Enums created
  - Used in HiredBarber

#### Task 3.19: Service - Barber Type Management
- **Status:** ⬜ Not Started
- **Estimated Time:** 4-5 hours
- **Description:** Service for managing barber types
- **Files to Create:**
  - `src/app/modules/barber/barber.management.service.ts`
- **Methods to Implement:**
  ```typescript
  - assignBarberType(saloonOwnerId: string, barberId: string, type: string, endDate?: Date): Promise<void>
  - changeBarberType(saloonOwnerId: string, barberId: string, newType: string): Promise<void>
  - removeTemporaryBarber(saloonOwnerId: string, barberId: string): Promise<void>
  - updateBarberStatus(saloonOwnerId: string, barberId: string, status: string): Promise<void>
  - getBarbersByType(saloonOwnerId: string, type: string): Promise<Barber[]>
  - getTemporaryBarbersNearExpiry(days: number): Promise<{barber, daysLeft}[]>
  - validateBarberTypeChange(barberId: string, newType: string): boolean
  ```
- **Dependencies:** Task 3.17, 3.18
- **Acceptance Criteria:**
  - All methods implemented
  - Validation working
  - Status transitions correct

#### Task 3.20: Controller & Routes - Barber Management Endpoints
- **Status:** ⬜ Not Started
- **Estimated Time:** 3-4 hours
- **Description:** API endpoints for barber management
- **Files to Modify:**
  - `src/app/modules/barber/barber.controller.ts`
  - `src/app/modules/barber/barber.routes.ts`
- **Endpoints to Add:**
  ```
  POST   /barber/assign-type        # Assign permanent/temporary
  PUT    /barber/{id}/type          # Change type
  DELETE /barber/{id}/remove        # Remove barber
  PUT    /barber/{id}/status        # Update status
  GET    /barber/by-type/{type}     # List by type
  ```
- **Dependencies:** Task 3.19
- **Acceptance Criteria:**
  - All endpoints working
  - Auth checks present
  - Response validation

#### Task 3.21: Automation - Temporary Barber Expiry Notification
- **Status:** ⬜ Not Started
- **Estimated Time:** 2-3 hours
- **Description:** Notify shop owner when temporary barber ending soon
- **Files to Create/Modify:**
  - Cron job or scheduled task
- **Implementation:**
  - Daily check for expiring temporary barbers
  - Send notification 7 days before
  - Send reminder 1 day before
  - Mark as removed on end date
- **Dependencies:** Task 3.19
- **Acceptance Criteria:**
  - Notifications sent on time
  - Barber auto-removed after end date
  - Owner has time to plan

#### Task 3.22: Testing - Barber Management Tests
- **Status:** ⬜ Not Started
- **Estimated Time:** 3-4 hours
- **Description:** Tests for barber type management
- **Files to Create:**
  - `src/app/modules/barber/barber.management.test.ts`
- **Test Cases:**
  - Assign permanent barber
  - Assign temporary barber with end date
  - Change barber type
  - Remove barber
  - Status transitions
  - Expiry notifications
- **Dependencies:** Task 3.19-3.21
- **Acceptance Criteria:**
  - All scenarios tested
  - >80% coverage
  - Edge cases handled

---

## PHASE 4: MEDIUM-HIGH - Polish & Integration
**Priority:** 🟡 MEDIUM-HIGH  
**Estimated Duration:** 2-3 weeks  
**Estimated Hours:** 50-70 hours  

### 📱 NOTIFICATION MODULE - Profile Pictures

#### Task 4.1: Database - Update Notification Model
- **Status:** ⬜ Not Started
- **Estimated Time:** 2 hours
- **Description:** Add profile picture fields to Notification
- **Files to Modify:**
  - `prisma/schema/models/Notification.prisma`
- **Changes:**
  ```prisma
  model Notification {
    // ... existing fields ...
    senderId        String?  @db.ObjectId
    senderImage     String?  // Profile image URL
    senderType      String?  // "CUSTOMER" | "BARBER" | "SALOON_OWNER" | "SYSTEM"
    senderName      String?  // Display name
    // ... rest of model ...
  }
  ```
- **Dependencies:** None
- **Acceptance Criteria:**
  - Model updated
  - Migration created

#### Task 4.2: Service - Notification Creation with Profile Picture
- **Status:** ⬜ Not Started
- **Estimated Time:** 3-4 hours
- **Description:** Update notification creation to include sender info
- **Files to Modify:**
  - `src/app/modules/notification/notification.service.ts`
- **Methods to Modify:**
  ```typescript
  - createNotification(userId: string, data: NotificationInput): Promise<Notification>
    // Should now fetch sender's profile image automatically
  ```
- **Implementation:**
  - Fetch sender's profile image
  - Determine sender type
  - Store in notification
  - Handle image fallbacks
- **Dependencies:** Task 4.1
- **Acceptance Criteria:**
  - Sender image automatically fetched
  - All sender types handled
  - Fallbacks for missing images

#### Task 4.3: Controller - Update Notification Endpoints
- **Status:** ⬜ Not Started
- **Estimated Time:** 2-3 hours
- **Description:** Update response to include profile pictures
- **Files to Modify:**
  - `src/app/modules/notification/notification.controller.ts`
  - Response formatting
- **Changes:**
  - Include senderImage in response
  - Include senderName in response
  - Include senderType in response
- **Dependencies:** Task 4.2
- **Acceptance Criteria:**
  - Notifications return profile data
  - Response format correct

#### Task 4.4: Frontend Integration Guide - Notification Images
- **Status:** ⬜ Not Started
- **Estimated Time:** 2 hours
- **Description:** Document notification image integration for frontend
- **Files to Create:**
  - `docs/NOTIFICATION_IMAGES.md`
- **Documentation:**
  - Response format with images
  - Fallback handling
  - Image caching strategy
  - Performance optimization
- **Dependencies:** Task 4.3
- **Acceptance Criteria:**
  - Clear integration guide
  - Code examples provided

#### Task 4.5: Testing - Notification with Images Tests
- **Status:** ⬜ Not Started
- **Estimated Time:** 2-3 hours
- **Description:** Tests for notification images
- **Files to Create:**
  - `src/app/modules/notification/notification.test.ts` (extend existing)
- **Test Cases:**
  - Notification with sender image
  - Missing image handling
  - All sender types
  - Image URL validation
- **Dependencies:** Task 4.2-4.4
- **Acceptance Criteria:**
  - All cases tested
  - Fallbacks working

---

### 🏪 SHOP DISPLAY & LOYALTY MODULE

#### Task 4.6: Database - Add Promotion Fields to SaloonOwner
- **Status:** ⬜ Not Started
- **Estimated Time:** 2-3 hours
- **Description:** Add active promotion tracking to shop
- **Files to Create/Modify:**
  - `prisma/schema/models/SaloonPromotion.prisma` (new model)
  - Or extend SaloonOwner model
- **Model:**
  ```prisma
  model SaloonPromotion {
    id                String   @id @default(auto()) @map("_id") @db.ObjectId
    saloonOwnerId     String   @db.ObjectId
    title             String   // "15% OFF", "Student Discount"
    description       String?
    discountType      String   // "PERCENTAGE" | "FIXED"
    discountValue     Float    // 15 for 15%, 5 for £5
    startDate         DateTime
    endDate           DateTime
    applicable        String[]? // Services or "ALL"
    active            Boolean  @default(true)
    createdAt         DateTime @default(now())
    updatedAt         DateTime @updatedAt
    
    // Relationships
    saloonOwner       SaloonOwner @relation(fields: [saloonOwnerId], references: [userId])
    
    @@map("saloon_promotions")
  }
  ```
- **Dependencies:** None
- **Acceptance Criteria:**
  - Model created
  - Migration done

#### Task 4.7: Service - Promotion Management
- **Status:** ⬜ Not Started
- **Estimated Time:** 3-4 hours
- **Description:** Service for managing promotions
- **Files to Create:**
  - `src/app/modules/promotion/promotion.service.ts`
- **Methods to Implement:**
  ```typescript
  - createPromotion(saloonOwnerId: string, data: PromotionInput): Promise<void>
  - updatePromotion(promotionId: string, data: PromotionUpdate): Promise<void>
  - deletePromotion(promotionId: string): Promise<void>
  - getActivePromotions(saloonOwnerId: string): Promise<Promotion[]>
  - getAllPromotions(saloonOwnerId: string): Promise<Promotion[]>
  - isPromotionActive(promotion: Promotion): boolean
  - deactivateExpiredPromotions(): Promise<number> // Cron job
  ```
- **Dependencies:** Task 4.6
- **Acceptance Criteria:**
  - All methods implemented
  - Date validation working
  - Expiry auto-handling

#### Task 4.8: Controller & Routes - Promotion Management
- **Status:** ⬜ Not Started
- **Estimated Time:** 3-4 hours
- **Description:** API endpoints for promotion management
- **Files to Create:**
  - `src/app/modules/promotion/promotion.controller.ts`
  - `src/app/modules/promotion/promotion.routes.ts`
- **Endpoints to Add:**
  ```
  POST   /saloon/promotion              # Create
  PUT    /promotion/{id}                # Update
  DELETE /promotion/{id}                # Delete
  GET    /saloon/active-promotions      # Active only
  GET    /saloon/all-promotions         # All
  ```
- **Dependencies:** Task 4.7
- **Acceptance Criteria:**
  - Endpoints working
  - Owner authorization checked
  - Response format correct

#### Task 4.9: Service - Shop Feed with Promotion Data
- **Status:** ⬜ Not Started
- **Estimated Time:** 4-5 hours
- **Description:** Update shop feed/list endpoint to include promotions
- **Files to Modify:**
  - `src/app/modules/saloon/saloon.service.ts`
  - Feed/search related services
- **Methods to Modify:**
  ```typescript
  - getShopFeed(filters, pagination): Promise<{shops with active promotions}>
  - searchShops(query): Promise<{shops with active promotions}>
  - getShopDetails(shopId): Promise<{shop with promotions}>
  ```
- **Dependencies:** Task 4.6, 4.7
- **Acceptance Criteria:**
  - Promotions included in responses
  - Only active promotions shown
  - Performance optimized

#### Task 4.10: Service - Loyalty Info with Shop Display
- **Status:** ⬜ Not Started
- **Estimated Time:** 4-5 hours
- **Description:** Include loyalty program info in shop display
- **Files to Modify:**
  - `src/app/modules/saloon/saloon.service.ts`
  - Loyalty program service integration
- **Implementation:**
  - Check if customer enrolled in shop's loyalty program
  - Get loyalty program details
  - Calculate points/rewards
  - Include in shop response
- **Dependencies:** Task 4.6, 4.7
- **Acceptance Criteria:**
  - Loyalty info in shop display
  - Enrollment status shown
  - Rewards calculated

#### Task 4.11: Frontend Integration - Shop Tile Display
- **Status:** ⬜ Not Started
- **Estimated Time:** 2-3 hours
- **Description:** Document shop tile display with promotions/loyalty
- **Files to Create:**
  - `docs/SHOP_TILE_DISPLAY.md`
- **Documentation:**
  - Response format with promotions
  - Loyalty info structure
  - UI rendering hints
  - Performance considerations
- **Dependencies:** Task 4.9, 4.10
- **Acceptance Criteria:**
  - Clear integration guide
  - Response examples provided

#### Task 4.12: Testing - Promotion & Shop Display Tests
- **Status:** ⬜ Not Started
- **Estimated Time:** 4-5 hours
- **Description:** Tests for promotions and shop display
- **Files to Create:**
  - `src/app/modules/promotion/promotion.test.ts`
  - `src/app/modules/saloon/saloon.shop-display.test.ts`
- **Test Cases:**
  - Create active promotion
  - Expired promotion handling
  - Multiple promotions per shop
  - Shop feed includes promotions
  - Loyalty info accuracy
  - Performance on large datasets
- **Dependencies:** Task 4.6-4.11
- **Acceptance Criteria:**
  - All scenarios tested
  - >80% coverage

---

### 🔗 QR CODE INTEGRATION

#### Task 4.13: Service - QR Booking Flow
- **Status:** ⬜ Not Started
- **Estimated Time:** 3-4 hours
- **Description:** Integrate QR code with booking/queue options
- **Files to Create:**
  - `src/app/modules/qrCode/qrCode.booking.service.ts`
- **Implementation:**
  - QR code scanned leads to booking/queue page
  - Show booking option
  - Show queue option
  - Pre-populate saloon/barber info
  - Handle non-registered users
- **Dependencies:** Task 1.1, existing QR module
- **Acceptance Criteria:**
  - QR flow leads to booking options
  - Both paths work
  - Non-registered user flow works

#### Task 4.14: Testing - QR Booking Integration Tests
- **Status:** ⬜ Not Started
- **Estimated Time:** 2-3 hours
- **Description:** Tests for QR code booking integration
- **Files to Create:**
  - `src/app/modules/qrCode/qrCode.booking.test.ts`
- **Test Cases:**
  - QR leads to booking page
  - QR leads to queue page
  - Non-registered user flow
  - Invalid QR handling
  - Shop info pre-filled
- **Dependencies:** Task 4.13
- **Acceptance Criteria:**
  - All paths tested
  - Error handling verified

---

## Summary of All Tasks

| Phase | Module | Task | Status | Effort | Dependencies |
|-------|--------|------|--------|--------|--------------|
| 1 | Booking | 1.1: Add deposit fields | ⬜ | 2-3h | - |
| 1 | Booking | 1.2: Create deposit policy | ⬜ | 2-3h | 1.1 |
| 1 | Booking | 1.3: Update saloon owner | ⬜ | 1-2h | 1.2 |
| 1 | Booking | 1.4: Update payment model | ⬜ | 2-3h | 1.1 |
| 1 | Booking | 1.5: Deposit validation schemas | ⬜ | 2-3h | - |
| 1 | Booking | 1.6: Deposit calc service | ⬜ | 4-5h | 1.2,1.4,1.5 |
| 1 | Booking | 1.7: Deposit endpoints | ⬜ | 4-5h | 1.6,1.5 |
| 1 | Booking | 1.8: Cancellation logic | ⬜ | 5-6h | 1.1,1.2,1.6 |
| 1 | Booking | 1.9: No-show forfeiture | ⬜ | 3-4h | 1.1,1.8 |
| 1 | Booking | 1.10: Remaining balance service | ⬜ | 6-7h | 1.1,1.4,1.6 |
| 1 | Booking | 1.11: Remaining balance endpoints | ⬜ | 4-5h | 1.10,1.11 |
| 1 | Booking | 1.12: Deposit policy service | ⬜ | 4-5h | 1.2,1.3 |
| 1 | Booking | 1.13: Deposit policy routes | ⬜ | 2-3h | 1.12 |
| 1 | Payment | 1.14: Escrow service | ⬜ | 5-6h | 1.1,1.4,1.6 |
| 1 | Payment | 1.15: Deposit processing | ⬜ | 4-5h | 1.6,1.14 |
| 1 | Payment | 1.16: Refund logic | ⬜ | 5-6h | 1.8,1.2 |
| 1 | Payment | 1.17: Remaining balance endpoints | ⬜ | 4-5h | 1.10,1.15 |
| 1 | Payment | 1.18: Booking completion | ⬜ | 4-5h | 1.14,1.8 |
| 1 | Testing | 1.19: Unit tests | ⬜ | 6-8h | 1.6-1.17 |
| 1 | Testing | 1.20: Integration tests | ⬜ | 6-8h | 1.6-1.17 |
| **Phase 1 Total** | | | | **90-110h** | |
| | | | | | |
| 2 | Blocking | 2.1: Create block model | ⬜ | 2-3h | - |
| 2 | Blocking | 2.2: Update user model | ⬜ | 1-2h | 2.1 |
| 2 | Blocking | 2.3: Block service | ⬜ | 4-5h | 2.1,2.2 |
| 2 | Blocking | 2.4: Block endpoints | ⬜ | 3-4h | 2.3 |
| 2 | Blocking | 2.5: Block middleware | ⬜ | 3-4h | 2.3 |
| 2 | Blocking | 2.6: Apply to messaging | ⬜ | 2-3h | 2.5 |
| 2 | Blocking | 2.7: Apply to booking | ⬜ | 2-3h | 2.5 |
| 2 | Blocking | 2.8: Apply to queue | ⬜ | 2-3h | 2.5 |
| 2 | Blocking | 2.9: Apply to profile | ⬜ | 2-3h | 2.5 |
| 2 | Blocking | 2.10: Block tests | ⬜ | 4-5h | 2.3-2.9 |
| 2 | Reporting | 2.11: Report model | ⬜ | 2-3h | - |
| 2 | Reporting | 2.12: Update user model | ⬜ | 1-2h | 2.11 |
| 2 | Reporting | 2.13: Report enum | ⬜ | 1h | - |
| 2 | Reporting | 2.14: Report service | ⬜ | 5-6h | 2.11,2.12,2.13 |
| 2 | Reporting | 2.15: Report endpoints | ⬜ | 3-4h | 2.14 |
| 2 | Reporting | 2.16: Admin workflow | ⬜ | 4-5h | 2.14 |
| 2 | Reporting | 2.17: Admin alerts | ⬜ | 3-4h | 2.14,2.16 |
| 2 | Reporting | 2.18: Report tests | ⬜ | 4-5h | 2.14-2.17 |
| **Phase 2 Total** | | | | **50-70h** | |
| | | | | | |
| 3 | Auth | 3.1: PlatForm enum | ⬜ | 1h | - |
| 3 | Auth | 3.2: User FB fields | ⬜ | 1-2h | 3.1 |
| 3 | Auth | 3.3: FB app setup | ⬜ | 2-3h | - |
| 3 | Auth | 3.4: FB OAuth service | ⬜ | 5-6h | 3.2,3.3 |
| 3 | Auth | 3.5: FB login endpoint | ⬜ | 3-4h | 3.4 |
| 3 | Auth | 3.6: FB validation | ⬜ | 2h | - |
| 3 | Auth | 3.7: FB integration guide | ⬜ | 2-3h | 3.4,3.5 |
| 3 | Auth | 3.8: FB tests | ⬜ | 4-5h | 3.4,3.5 |
| 3 | Customer | 3.9: Profile model | ⬜ | 2-3h | - |
| 3 | Customer | 3.10: Add to user | ⬜ | 1h | 3.9 |
| 3 | Customer | 3.11: Profile service | ⬜ | 5-6h | 3.9,3.10 |
| 3 | Customer | 3.12: Privacy service | ⬜ | 4-5h | 3.9,3.11 |
| 3 | Customer | 3.13: Storage setup | ⬜ | 3-4h | - |
| 3 | Customer | 3.14: Profile endpoints | ⬜ | 4-5h | 3.11,3.12 |
| 3 | Customer | 3.15: Barber integration | ⬜ | 2-3h | 3.12,3.14 |
| 3 | Customer | 3.16: Profile tests | ⬜ | 5-6h | 3.11-3.15 |
| 3 | Barber | 3.17: Hired barber update | ⬜ | 2h | - |
| 3 | Barber | 3.18: Barber enums | ⬜ | 1h | - |
| 3 | Barber | 3.19: Type management | ⬜ | 4-5h | 3.17,3.18 |
| 3 | Barber | 3.20: Type endpoints | ⬜ | 3-4h | 3.19 |
| 3 | Barber | 3.21: Expiry automation | ⬜ | 2-3h | 3.19 |
| 3 | Barber | 3.22: Type tests | ⬜ | 3-4h | 3.19-3.21 |
| **Phase 3 Total** | | | | **70-95h** | |
| | | | | | |
| 4 | Notification | 4.1: Update model | ⬜ | 2h | - |
| 4 | Notification | 4.2: Notification service | ⬜ | 3-4h | 4.1 |
| 4 | Notification | 4.3: Notification endpoints | ⬜ | 2-3h | 4.2 |
| 4 | Notification | 4.4: Integration guide | ⬜ | 2h | 4.3 |
| 4 | Notification | 4.5: Notification tests | ⬜ | 2-3h | 4.2-4.4 |
| 4 | Shop/Loyalty | 4.6: Promotion model | ⬜ | 2-3h | - |
| 4 | Shop/Loyalty | 4.7: Promotion service | ⬜ | 3-4h | 4.6 |
| 4 | Shop/Loyalty | 4.8: Promotion endpoints | ⬜ | 3-4h | 4.7 |
| 4 | Shop/Loyalty | 4.9: Shop feed service | ⬜ | 4-5h | 4.6,4.7 |
| 4 | Shop/Loyalty | 4.10: Loyalty display | ⬜ | 4-5h | 4.6,4.7 |
| 4 | Shop/Loyalty | 4.11: Integration guide | ⬜ | 2-3h | 4.9,4.10 |
| 4 | Shop/Loyalty | 4.12: Display tests | ⬜ | 4-5h | 4.6-4.11 |
| 4 | QR | 4.13: QR booking flow | ⬜ | 3-4h | 1.1, existing QR |
| 4 | QR | 4.14: QR tests | ⬜ | 2-3h | 4.13 |
| **Phase 4 Total** | | | | **45-60h** | |
| | | | | | |
| **GRAND TOTAL** | | **89 Tasks** | | **255-335 hours** | |

---

## Implementation Notes

### Best Practices
1. **Database Migrations:** Create and test migration for each schema change
2. **API Versioning:** Consider versioning new endpoints (e.g., `/v2/booking/create-deposit`)
3. **Backwards Compatibility:** Ensure existing APIs still work during transition
4. **Feature Flags:** Use feature flags for gradual rollout
5. **Monitoring:** Add logging for all deposit/payment operations
6. **Documentation:** Keep API docs updated with each change

### Testing Strategy
1. Unit tests for business logic (deposits, refunds, blocking)
2. Integration tests for workflows (booking → payment → completion)
3. End-to-end tests for critical paths
4. Load testing for payment operations
5. Security testing for user blocking and profile access

### Deployment Strategy
1. Phase 1 → Staging → Production (2-3 week rollout)
2. Canary deployment for payment features (10% → 50% → 100%)
3. Rollback plan for each phase
4. Database backup before migrations
5. Customer communication on new features

### Performance Considerations :-
1. Index deposit and payment fields in Booking/Payment models
2. Cache active promotions
3. Optimize blocking checks (use Redis cache)
4. Optimize profile access checks
5. Lazy load profile images in notifications

---

End of Task List
