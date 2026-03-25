# Apple IAP Migration - Implementation Summary

## ✅ Completed Changes

### 1. **Configuration Updates**
- [x] Removed Stripe configuration
- [x] Added Apple IAP configuration (BUNDLE_ID, TEAM_ID, KEY_ID, PRIVATE_KEY, SHARED_SECRET)
- [x] Updated `src/config/index.ts`

### 2. **Database Schema Updates**
- [x] Updated `UserSubscription.prisma` model
  - Removed: `stripeSubscriptionId`
  - Added: `appleTransactionId`, `appleProductId`, `appleOriginalTransactionId`, `autoRenew`, `cancellationReason`

- [x] Updated `Payment.prisma` model
  - Removed: `stripeSubscriptionId`, `paymentIntentId`, `paymentMethodId`, `amountProvider`, `amountReceiver`, `invoiceId`
  - Added: `appleTransactionId`, `appleProductId`, `appleReceiptData`

### 3. **Service Layer Refactoring**
- [x] Created `appleIAP.service.ts` - Apple verification service
  - `verifyAppleReceipt()` - Verify transaction with Apple servers
  - `verifyAppleReceiptData()` - Alternative receipt verification
  - `verifyAppleWebhookSignature()` - Webhook signature validation
  - `parseAppleWebhookNotification()` - Parse webhook payloads
  - `getAppleTransactionHistory()` - Get renewal history

- [x] Created `appleWebhook.service.ts` - Webhook handler
  - `handleRenewalNotification()` - Process renewal events
  - `handleCancellationNotification()` - Process cancellation
  - `handleExpirationNotification()` - Process expiration
  - `handleRefundNotification()` - Process refunds
  - `handleAppleServerNotification()` - Main webhook router

- [x] Refactored `userSubscription.service.ts`
  - **Removed all Stripe calls**
  - **Updated `createUserSubscriptionIntoDb()`** - Now accepts `appleTransactionId` instead of `paymentMethodId`
  - **Updated `updateUserSubscriptionIntoDb()`** - Renewal with Apple IAP
  - **Updated `cancelAutomaticRenewalIntoDb()`** - Sets `autoRenew` to false
  - **Updated `deleteCustomerSubscriptionItemFromDb()`** - Admin deletion
  - **Updated `deleteUserSubscriptionItemFromDb()`** - User deletion

### 4. **Controller Layer**
- [x] Created `appleIAP.controller.ts` with endpoints:
  - `verifyAppleReceipt()` - Verify purchase receipt
  - `handleAppleWebhook()` - Webhook handler
  - `checkSubscriptionStatus()` - Check if subscription is valid
  - `getTransactionHistory()` - Get renewal history for restoration

### 5. **Validation Updates**
- [x] Updated `userSubscription.validation.ts`
  - Changed `paymentMethodId` → `appleTransactionId`
  - Added optional `receiptData` field
  - Added `verifyAppleReceiptSchema` for verification endpoint

### 6. **Routes Updates**
- [x] Updated `userSubscription.routes.ts`
  - **Added Apple IAP endpoints:**
    - `POST /api/subscription/apple/verify-receipt` - Verify receipt
    - `POST /api/subscription/apple/webhook` - Webhook (no auth)
    - `POST /api/subscription/apple/check-status` - Check status
    - `POST /api/subscription/apple/transaction-history` - Get history
  - **Updated existing endpoints** to work with Apple IAP

## 📋 API Flow Overview

### **New Subscription Flow**

```
1. iOS App makes purchase via App Store
   ↓
2. Apple returns transactionId to app
   ↓
3. App sends POST /subscription with {appleTransactionId, subscriptionOfferId}
   ↓
4. Backend verifies transaction with Apple
   ↓
5. If valid: Create subscription in MongoDB + send confirmation email
   ↓
6. Return success to app
```

### **Webhook Flow (Automatic)**

```
Apple App Store
   ↓
POST /subscription/apple/webhook with {signedPayload}
   ↓
Backend decodes and verifies signature
   ↓
Routes to handler based on notification type:
   RENEWAL → Update subscription + extend endDate
   CANCELLED → Mark as cancelled
   EXPIRED → Mark as expired
   REFUNDED → Mark payment as refunded
   ↓
Database updated automatically
```

## 🔄 Subscription Lifecycle

### **Status Transitions**

```
┌─────────────────────────────────────────────────────┐
│  New Purchase → PENDING                             │
│     (Receipt verification in progress)              │
└─────────────┬───────────────────────────────────────┘
              │
              ↓ (Verified)
┌─────────────────────────────────────────────────────┐
│  Active Subscription → COMPLETED                    │
│     (autoRenew = true, active until endDate)        │
└─────────────┬───────────────────────────────────────┘
              │
    ┌─────────┴──────────────┐
    ↓                        ↓
RENEWAL          User Cancels / Expires
(Auto or manual)       │
    │                  ↓
    │    ┌─────────────────────────────┐
    │    │ Marked CANCELLED            │
    │    │ (autoRenew = false)         │
    │    │ (still active until endDate)│
    │    └─────────────────────────────┘
    │
    ↓ (Renewed)
┌─────────────────────────────────────────────────────┐
│  Renewed → COMPLETED                                │
│     (New transaction, new endDate)                  │
└─────────────────────────────────────────────────────┘
```

## 🚀 Deployment Checklist

### **Before Going Live:**

- [ ] Set `NODE_ENV=production` in production server
- [ ] Add all Apple IAP environment variables to production `.env`
- [ ] Run database migration: `npx prisma migrate deploy`
- [ ] Set webhook URL in App Store Connect to your production domain
- [ ] Test with TestFlight users (sandbox credentials)
- [ ] Create test App Store user (App Store Connect > Users and Roles)
- [ ] Test all subscription flows in sandbox
- [ ] Test webhook delivery (check webhook event history in App Store Connect)
- [ ] Enable HTTPS on webhook endpoint
- [ ] Set up monitoring/alerting for webhook failures
- [ ] Monitor subscription metrics in App Store Connect

### **Environment Variables Required:**

```bash
# Core
NODE_ENV=production
PORT=5000

# Apple IAP (Required)
APPLE_BUNDLE_ID=com.barbershift.app
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_KEY_ID=XXXXXXXXXX
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
APPLE_SHARED_SECRET=your_secret

# Database & Others (existing)
DATABASE_URL=...
JWT_ACCESS_SECRET=...
# ... other existing variables
```

## 📱 iOS App Integration

### **What the iOS app needs to do:**

```swift
// 1. Make purchase via StoreKit 2
let product = products.first { $0.id == "premium.monthly" }
let result = try await product?.purchase()

// 2. When purchase succeeds, get transaction ID
if case .success(let verification) = result {
    let transaction = try verification.payloadValue
    let transactionId = String(transaction.id)
    
    // 3. Send to backend
    let response = try await URLSession.shared.data(
        from: URL(string: "https://api.app.com/subscription")!,
        with: request // Include transactionId
    )
}

// 4. On app launch, verify subscription is still valid
// (Optional - Apple handles most of this, but good for UX)
let status = try await SKPaymentQueue.default().appStoreReceiptURL
```

## 🔧 Post-Migration Cleanup

### **Remove These:**
- [ ] All Stripe-related imports and dependencies
- [ ] Stripe customer ID fields from User model
- [ ] `stripe_secret_key`, `stripe_publishable_key`, `stripe_webhook_secret` from env vars
- [ ] Any Stripe TypeScript types
- [ ] Old Stripe webhook routes (if any)

### **Run These Commands:**
```bash
# Update database schema
npx prisma migrate dev --name remove_stripe_add_apple

# Update Prisma client
npx prisma generate

# Check for remaining Stripe references
grep -r "stripe" src/ --include="*.ts"
grep -r "Stripe" src/ --include="*.ts"
```

## 📊 Monitoring & Metrics

### **Key Metrics to Track:**

1. **Webhook Success Rate**
   - Should be 99%+
   - Check App Store Connect webhook delivery logs

2. **Subscription Renewal Rate**
   - Monitor renewal notifications
   - Track failed renewals

3. **Cancellation Rate**
   - Monitor cancellation notifications
   - Track reasons for cancellations

4. **Refund Rate**
   - Monitor refund notifications
   - Track refund patterns

### **Common Issues & Debugging:**

| Issue | Debug Steps |
|-------|------------|
| Webhook not received | Check webhook URL in App Store Connect, verify HTTPS, check firewall |
| Receipt verification fails | Validate transaction ID format, check Apple credentials, check sandbox vs production |
| Payment not recorded | Check database transaction logs, verify Prisma connection |
| No renewal notifications | Check webhook configuration, verify autoRenew is true, check Apple account settings |

## 🎯 Next Steps

1. **Migrate Database**
   ```bash
   npx prisma migrate dev --name apple_iap_migration
   ```

2. **Test All Endpoints**
   - Use Postman to test all subscription endpoints
   - Test webhook with Apple's test tool

3. **Update iOS App**
   - Replace payment method collection with App Store purchase
   - Send `appleTransactionId` to backend
   - Handle subscription restoration

4. **Deploy to Production**
   - Update environment variables
   - Run migration on prod database
   - Configure App Store Connect webhook
   - Test with live TestFlight users

5. **Monitor & Optimize**
   - Watch webhook logs
   - Monitor renewal rates
   - Collect user feedback

## 📚 Documentation Files

- `APPLE_IAP_SETUP.md` - Complete setup guide with credentials
- `appleIAP.service.ts` - Receipt verification service
- `appleWebhook.service.ts` - Webhook handling service
- `appleIAP.controller.ts` - API endpoints
- `userSubscription.service.ts` - Updated subscription logic

## ✨ Summary of Improvements

✅ **Removed technical debt** - No more Stripe dependency  
✅ **Complies with App Store policies** - Apple IAP for digital services  
✅ **Automatic renewal** - Apple handles billing  
✅ **Better security** - Private key management instead of API keys  
✅ **Revenue share** - Correct (Apple takes 30%, you keep 70%)  
✅ **Webhook automation** - Automatic updates for all subscription events  
✅ **Restoration** - Users can restore purchases on new devices  
✅ **Grace period support** - Built-in for lapsed subscriptions  
