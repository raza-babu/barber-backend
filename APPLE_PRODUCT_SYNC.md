# Apple IAP Product Setup & Sync Guide

## Overview

When you create a subscription plan in your backend, you also need to create a matching product in Apple App Store Connect. Then sync the Apple product IDs back to your database.

## Step 1: Create Subscription Plans in App Store Connect

### 1.1 Go to App Store Connect

1. Navigate to **App Store Connect** → **Apps** → **Your App**
2. Go to **In-App Purchases**
3. Click **+** to create a new in-app purchase

### 1.2 Create Auto-Renewable Subscription

**Type:** Auto-Renewable Subscription

**Example Plan: Premium Monthly**

| Field | Value | Notes |
|-------|-------|-------|
| Reference Name | Premium Monthly | Internal name (users don't see this) |
| Product ID | `com.barbershift.premium.monthly` | **Save this! You'll need it in backend** |
| Localization Language | English |
| Display Name | Premium Monthly Plan | What users see |
| Description | Get access to premium features for 30 days | |
| Subscription Duration | 1 Month | |
| Price Tier | Tier 3 ($9.99) | Or your desired price |
| Billing Period | 1 month | |
| Renewal | Yes | Auto-renew enabled |

**Save and note your Product ID:** `com.barbershift.premium.monthly`

### 1.3 Create More Plans (Examples)

| Product ID | Display Name | Duration | Price |
|------------|-------------|----------|-------|
| `com.barbershift.premium.weekly` | Premium Weekly | 1 Week | $2.99 |
| `com.barbershift.premium.monthly` | Premium Monthly | 1 Month | $9.99 |
| `com.barbershift.premium.yearly` | Premium Yearly | 1 Year | $79.99 |

---

## Step 2: Create Plans in Your Backend

### 2.1 Create Via API/Database

When a Saloon Owner creates a subscription plan, include the Apple Product ID:

**Endpoint:** `POST /subscription-offers/` (or wherever you create plans)

**Request:**
```json
{
  "title": "Premium Monthly",
  "description": "Get access to premium features",
  "price": 9.99,
  "duration": "MONTHLY",
  "durationDays": 30,
  "planType": "BASIC_PREMIUM",
  "appleProductId": "com.barbershift.premium.monthly"
}
```

**Response:**
```json
{
  "id": "offer_123abc",
  "title": "Premium Monthly",
  "price": 9.99,
  "appleProductId": "com.barbershift.premium.monthly",
  "createdAt": "2024-03-16T10:00:00Z"
}
```

### 2.2 Database Record

Your subscription offer now looks like:

```json
{
  "_id": "offer_123abc",
  "userId": "user_456def",
  "title": "Premium Monthly",
  "price": 9.99,
  "duration": "MONTHLY",
  "durationDays": 30,
  "planType": "BASIC_PREMIUM",
  "appleProductId": "com.barbershift.premium.monthly",  // ← NEW FIELD
  "status": "ACTIVE",
  "createdAt": "2024-03-16T10:00:00Z"
}
```

---

## Step 3: Sync Product IDs

### 3.1 Manual Sync (Simple)

When creating a plan in backend:

1. Create in App Store Connect first
2. Copy the Product ID
3. Paste it when creating the backend plan

### 3.2 Automated Sync (Advanced)

Create a sync endpoint that compares App Store with your database:

**Endpoint:** `POST /subscription-offers/sync-apple-products`

```typescript
export const syncAppleProducts = catchAsync(async (req, res) => {
  // 1. Fetch all offers from database
  const dbOffers = await prisma.subscriptionOffer.findMany({
    where: { status: 'ACTIVE' }
  });

  // 2. Get all products from App Store Connect
  const appleProducts = await getAppleProducts(); // Requires Apple API

  // 3. Compare and report mismatches
  const mismatches = dbOffers.filter(offer => 
    !appleProducts.find(ap => ap.id === offer.appleProductId)
  );

  if (mismatches.length > 0) {
    return res.json({
      warning: "Found products in DB but not on App Store",
      mismatches: mismatches.map(m => ({
        id: m.id,
        title: m.title,
        appleProductId: m.appleProductId
      }))
    });
  }

  return res.json({
    success: true,
    message: "All products synced correctly",
    totalOffers: dbOffers.length
  });
});
```

---

## Step 4: Validate During Subscription Creation

### 4.1 Update Validation Schema

When user creates a subscription, validate the offer has an Apple Product ID:

```typescript
// userSubscription.validation.ts
const createSchema = z.object({
  body: z.object({
    appleTransactionId: z.string({
      required_error: 'Apple Transaction ID is required!',
    }),
    subscriptionOfferId: z.string({
      required_error: 'Subscription Offer ID is required!',
    }),
  }),
});
```

### 4.2 Update Service to Check Product ID

```typescript
// In createUserSubscriptionIntoDb function

// 4. Fetch subscription offer
const subscriptionOffer = await prisma.subscriptionOffer.findUnique({
  where: { id: data.subscriptionOfferId },
  select: {
    id: true,
    planType: true,
    price: true,
    durationDays: true,
    appleProductId: true,  // ← Check this
    creator: { select: { id: true } },
  },
});

if (!subscriptionOffer) {
  throw new AppError(
    httpStatus.BAD_REQUEST,
    'Subscription offer not found',
  );
}

// ← NEW: Validate Apple product ID exists
if (!subscriptionOffer.appleProductId) {
  throw new AppError(
    httpStatus.BAD_REQUEST,
    'Subscription plan not configured for Apple IAP. Contact support.',
  );
}

// 3. Verify Apple receipt/transaction
let appleTransactionData: any;
try {
  appleTransactionData = await appleIAPService.verifyAppleReceipt(
    data.appleTransactionId,
  );
  
  // ← NEW: Validate the product ID matches
  if (appleTransactionData.productId !== subscriptionOffer.appleProductId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Product ID mismatch. User purchased different plan than selected.',
    );
  }
} catch (err) {
  console.error('Apple receipt verification failed:', err);
  throw new AppError(
    httpStatus.BAD_REQUEST,
    'Apple receipt verification failed.',
  );
}
```

---

## Step 5: Update on Webhook

When Apple sends renewal notifications, extract and store the product ID:

```typescript
// appleWebhook.service.ts

const handleRenewalNotification = async (
  notification: AppleNotificationPayload,
) => {
  const { data } = notification;

  // data.productId comes from Apple
  // This should match subscriptionOffer.appleProductId

  const subscription = await prisma.userSubscription.findFirst({
    where: {
      appleOriginalTransactionId: data.originalTransactionId,
    },
  });

  if (!subscription) {
    console.warn('Subscription not found for renewal');
    return;
  }

  // Store the product ID from Apple
  const updatedSubscription = await prisma.$transaction(async tx => {
    const updated = await tx.userSubscription.update({
      where: { id: subscription.id },
      data: {
        appleTransactionId: data.transactionId,
        appleProductId: data.productId,  // ← Store product ID
        endDate: new Date(parseInt(data.expiresDate || '') || Date.now() + 30 * 24 * 60 * 60 * 1000),
        paymentStatus: PaymentStatus.COMPLETED,
      },
    });
    return updated;
  });
};
```

---

## Step 6: Testing Product ID Sync

### 6.1 Verify in Database

```bash
# MongoDB command
db.subscription_offers.find({ appleProductId: { $exists: true } })

# Expected output:
[
  {
    "_id": ObjectId("..."),
    "title": "Premium Monthly",
    "price": 9.99,
    "appleProductId": "com.barbershift.premium.monthly",
    ...
  }
]
```

### 6.2 Test Subscription Creation with Correct Product ID

**Request:**
```json
{
  "appleTransactionId": "1234567890",
  "subscriptionOfferId": "offer_123abc"
}
```

**Backend checks:**
1. ✅ Offer exists
2. ✅ Offer has appleProductId
3. ✅ Verify receipt with Apple
4. ✅ Product ID in receipt matches offer's appleProductId
5. ✅ Create subscription

### 6.3 Test with Mismatched Product ID

If auto-renewal happens with different product:
- ✅ Webhook contains correct product ID
- ✅ Backend updates with new product ID
- ✅ User can see which plan they're currently on

---

## Step 7: API Endpoints for Plan Management

### Create Plan (with Apple Product ID)

**Endpoint:** `POST /subscription-offers`

```json
{
  "title": "Premium Monthly",
  "description": "Monthly subscription",
  "price": 9.99,
  "duration": "MONTHLY",
  "durationDays": 30,
  "planType": "BASIC_PREMIUM",
  "appleProductId": "com.barbershift.premium.monthly"
}
```

### Get Plan Details (including Product ID)

**Endpoint:** `GET /subscriptions/`

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": "offer_123",
      "title": "Premium Monthly",
      "price": 9.99,
      "appleProductId": "com.barbershift.premium.monthly",
      "duration": "MONTHLY",
      "durationDays": 30
    }
  ]
}
```

### Update Plan Product ID

**Endpoint:** `PUT /subscription-offers/:id`

```json
{
  "appleProductId": "com.barbershift.premium.monthly.new"
}
```

---

## Step 8: Product ID Naming Convention

**Recommended Format:**

```
com.barbershift.[plan_type].[duration]

Examples:
- com.barbershift.premium.weekly    (1 week)
- com.barbershift.premium.monthly   (1 month)
- com.barbershift.premium.yearly    (1 year)
- com.barbershift.standard.monthly  (for different plan types)
```

**Benefits:**
- Easy to understand
- Matches App Store naming
- Prevents confusion with other apps

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Product ID mismatch" | User bought different plan. Check App Store vs backend |
| appleProductId is null | Plan not configured for Apple IAP. Add product ID |
| Webhook has wrong product ID | Verify plan mapping in App Store |
| Product removed from App Store | Update/remove from backend too |

---

## Summary

**Before Going Live:**

1. ✅ Create products in App Store Connect
2. ✅ Document all Product IDs
3. ✅ Create matching backend plans with Product IDs
4. ✅ Test subscription creation
5. ✅ Test webhook renewal
6. ✅ Verify product ID syncing
7. ✅ Monitor for mismatches
