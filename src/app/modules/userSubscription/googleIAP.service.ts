import axios from 'axios';
import config from '../../../config';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { google } from 'googleapis';

/**
 * Google IAP Service
 * Handles verification of Google Play In-App Purchase receipts
 */

const GOOGLE_PLAY_API_BASE =
  'https://androidpublisher.googleapis.com/androidpublisher/v3';

/**
 * Mapping of subscription plan types to Google Play subscription IDs
 */
const SUBSCRIPTION_ID_MAPPING: Record<string, string> = {
  silver: 'com.barberstime.barber_time_app.monthly',
  gold: 'com.barberstime.barber_time_app.gmonthly',
  diamond: 'com.barberstime.barber_time_app.dmonthly',
};

/**
 * Initialize Google Play API client
 * Uses credentials from environment variables
 */
const initializeGooglePlayClient = async () => {
  try {
    const credentials = config.google?.credentials; // done

    console.log(
      {
        credentials,
      },
      { depth: Infinity },
    );

    if (!credentials) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Google IAP credentials not configured',
      );
    }

    let parsedCredentials;
    try {
      parsedCredentials = JSON.parse(credentials);
      console.log(parsedCredentials);
    } catch (parseError: any) {
      console.error(
        '❌ Failed to parse Google credentials JSON:',
        parseError.message,
      );
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        `Invalid Google credentials JSON: ${parseError.message}`,
      );
    }

    const auth = new google.auth.GoogleAuth({
      credentials: parsedCredentials,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    const authClient = await auth.getClient();
    return authClient;
  } catch (error: any) {
    // If already an AppError, re-throw it
    if (error instanceof AppError) {
      throw error;
    }

    console.error('❌ Failed to initialize Google Play client:', error.message);
    console.error('Error details:', error);

    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Google Play authentication failed: ${error.message}`,
    );
  }
};

// /**
//  * Verify Google Play purchase token
//  * Validates the purchase against Google Play's backend
//  */
// const verifyGooglePlayPurchase = async (
//   packageName: string,
//   subscriptionId: string,
//   purchaseToken: string,
// ): Promise<any> => {
//   try {
//     // Get authenticated client
//     const authClient = await initializeGooglePlayClient();

//     console.log('🔗 Google Play API Request:');
//     console.log(
//       `   URL: /purchases/subscriptionsv2/${subscriptionId}/tokens/${purchaseToken}`,
//     );
//     console.log('   Package Name:', packageName);
//     console.log('   Subscription ID:', subscriptionId);
//     console.log('   Method: GET');

//     // Make request to Google Play API
//     const url = `${GOOGLE_PLAY_API_BASE}/applications/${packageName}/purchases/tokens/${purchaseToken}`;

//     const response = await axios.get(url, {
//       headers: {
//         Authorization: `Bearer ${await getGoogleAccessToken(authClient)}`,
//       },
//     });

//     console.log('✅ Google Play API Response:', response.status);
//     console.log('Purchase Data:', {
//       orderId: response.data.orderId,
//       autoRenewing: response.data.autoRenewing,
//       paymentState: response.data.paymentState,
//       expiryTime: new Date(parseInt(response.data.expiryTimeMillis)),
//     });

//     if (response.status !== 200) {
//       throw new AppError(
//         httpStatus.BAD_REQUEST,
//         'Google Play purchase verification failed',
//       );
//     }

//     // Validate purchase state (1 = Purchased)
//     if (response.data.paymentState !== 1) {
//       throw new AppError(
//         httpStatus.BAD_REQUEST,
//         'Invalid purchase state. Payment not completed.',
//       );
//     }

//     // Check if subscription is still valid
//     const expiryTime = new Date(parseInt(response.data.expiryTimeMillis));
//     if (expiryTime < new Date()) {
//       console.warn('⚠️ Subscription has expired:', expiryTime);
//       throw new AppError(
//         httpStatus.BAD_REQUEST,
//         'Subscription has expired. Please renew.',
//       );
//     }

//     return {
//       ...response.data,
//       isValid: true,
//       expiryDate: expiryTime.toISOString(),
//       startDate: new Date(
//         parseInt(response.data.startTimeMillis),
//       ).toISOString(),
//     };
//   } catch (error: any) {
//     const { status, googleMessage, errorBody } = formatGoogleApiError(error);

//     console.log(error);
//     console.error('❌ Google Play purchase verification error:', error.message);
//     if (errorBody) {
//       console.error(
//         '   Google Play API error response:',
//         JSON.stringify(errorBody, null, 2),
//       );
//     }

//     if (status === 400) {
//       console.error('   ❌ Bad Request (400)');
//       console.error(
//         '   Invalid package name, subscription ID, or purchase token',
//       );
//       throw new AppError(
//         httpStatus.BAD_REQUEST,
//         `Invalid purchase details. ${googleMessage || 'Please verify package name, subscription ID, and purchase token.'}`,
//       );
//     }

//     if (status === 401) {
//       console.error('   🔑 Authentication Failed (401)');
//       console.error(
//         '   Google IAP credentials are invalid, expired, or the service account is not authorized',
//       );
//       throw new AppError(
//         httpStatus.UNAUTHORIZED,
//         `Google IAP authentication failed. ${googleMessage || 'Please verify service account credentials and API access.'}`,
//       );
//     }

//     if (status === 404) {
//       console.error('   ❌ Not Found (404)');
//       console.error('   Purchase token not found in Google Play records');
//       throw new AppError(
//         httpStatus.NOT_FOUND,
//         `Purchase not found. ${googleMessage || 'The purchase token may be invalid, expired, or belong to another app/subscription.'}`,
//       );
//     }

//     throw error instanceof AppError
//       ? error
//       : new AppError(
//           httpStatus.BAD_REQUEST,
//           `Google Play purchase verification failed: ${googleMessage || error.message}`,
//         );
//   }
// };

/**
 * Verify Google Play purchase token using the SubscriptionsV2 API
 * Required for modern subscriptions with Base Plans and Offers.
 */
const verifyGooglePlayPurchase = async (
  packageName: string,
  purchaseToken: string,
): Promise<any> => {
  try {
    // 1. Get authenticated client (Service Account)
    const authClient = await initializeGooglePlayClient();
    const accessToken = await getGoogleAccessToken(authClient);

    // 2. Build the V2 URL
    // IMPORTANT: Path is 'subscriptionsv2'. No 'subscriptionId' is needed in the URL path.
    const url = `${GOOGLE_PLAY_API_BASE}/applications/${packageName}/purchases/subscriptionsv2/tokens/${purchaseToken}`;

    console.log('🔗 Google Play API v2 Request:');
    console.log(`   URL: ${url}`);

    // 3. Execute request
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = response.data;

    // 4. Validate the response structure
    if (!data || !data.lineItems || data.lineItems.length === 0) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'No subscription items found for this token.',
      );
    }

    // Google V2 API returns an array of lineItems. Usually, for a single purchase,
    // the first item is the relevant one.
    const latestLineItem = data.lineItems[0];

    /**
     * Google V2 States:
     * SUBSCRIPTION_STATE_PENDING: 0
     * SUBSCRIPTION_STATE_ACTIVE: 1
     * SUBSCRIPTION_STATE_PAUSED: 2
     * SUBSCRIPTION_STATE_IN_GRACE_PERIOD: 3
     * SUBSCRIPTION_STATE_ON_HOLD: 4 (Payment failed)
     * SUBSCRIPTION_STATE_CANCELED: 5
     * SUBSCRIPTION_STATE_EXPIRED: 6
     */
    const activeStates = [
      'SUBSCRIPTION_STATE_ACTIVE',
      'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
    ];

    const isStateValid = activeStates.includes(data.subscriptionState);
    const expiryTime = new Date(latestLineItem.expiryTime);
    const isNotExpired = expiryTime > new Date();

    console.log('✅ Google Play API Response Success');
    console.log('Purchase Details:', {
      orderId: data.latestOrderId,
      productId: latestLineItem.productId, // This is your 'dmonthly', etc.
      state: data.subscriptionState,
      expiry: latestLineItem.expiryTime,
    });

    // 5. Final Validation
    if (!isStateValid || !isNotExpired) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Subscription is not active. Status: ${data.subscriptionState}`,
      );
    }

    // Return a standardized object for your database
    return {
      isValid: true,
      productId: latestLineItem.productId,
      orderId: data.latestOrderId,
      purchaseToken: purchaseToken,
      expiryDate: expiryTime.toISOString(),
      startDate: new Date(data.startTime).toISOString(),
      acknowledgementState: data.acknowledgementState, // 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'
      raw: data,
    };
  } catch (error: any) {
    // Re-use your existing error formatter
    const { status, googleMessage, errorBody } = formatGoogleApiError(error);

    console.error('❌ Verification Error:', error.message);

    if (errorBody) {
      console.error('API Error Body:', JSON.stringify(errorBody, null, 2));
    }

    // Pass the specific Google error message back to the UI if possible
    throw error instanceof AppError
      ? error
      : new AppError(
          status || httpStatus.INTERNAL_SERVER_ERROR,
          `Google Play verification failed: ${googleMessage || error.message}`,
        );
  }
};

/**
 * Get Google access token from authenticated client
 */
const formatGoogleApiError = (error: any) => {
  const errorBody = error?.response?.data;
  const status = error?.response?.status;
  const googleMessage =
    errorBody?.error?.message ||
    errorBody?.error_description ||
    errorBody?.message ||
    error?.message;

  return { status, googleMessage, errorBody };
};

const getGoogleAccessToken = async (authClient: any): Promise<string> => {
  try {
    const result = await authClient.getAccessToken();
    const token = result?.token || result?.access_token;

    if (!token) {
      console.error(
        '❌ Access token result structure:',
        JSON.stringify(result, null, 2),
      );
      throw new Error('Failed to obtain access token from Google auth client');
    }
    return token;
  } catch (error: any) {
    console.error('❌ Failed to get Google access token:', error.message);
    console.error('   Error details:', error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to authenticate with Google Play',
    );
  }
};

/**
 * Validate subscription ID against supported plans
 * Accepts both short form (silver, gold, diamond) and full form (com.barberstime.barber_time_app.monthly, etc)
 */
const validateSubscriptionId = (planInput: string): string => {
  const lowerInput = planInput.toLowerCase();

  // First, try to match short form (silver, gold, diamond)
  const shortFormMatch = SUBSCRIPTION_ID_MAPPING[lowerInput];
  if (shortFormMatch) {
    return shortFormMatch;
  }

  // Second, try to match full form (com.barberstime.barber_time_app.monthly, etc)
  const fullFormMatch = Object.values(SUBSCRIPTION_ID_MAPPING).find(
    value => value.toLowerCase() === lowerInput,
  );
  if (fullFormMatch) {
    return fullFormMatch;
  }

  // Invalid - throw error with supported types
  throw new AppError(
    httpStatus.BAD_REQUEST,
    `Invalid plan type. Supported short forms: ${Object.keys(SUBSCRIPTION_ID_MAPPING).join(', ')} or full forms: ${Object.values(SUBSCRIPTION_ID_MAPPING).join(', ')}`,
  );
};

/**
 * Get subscription purchase history (for restoration)
 * Useful for subscription restoration on new devices
 */
const getSubscriptionPurchaseHistory = async (
  packageName: string,
  subscriptionId: string,
  purchaseToken: string,
): Promise<any> => {
  try {
    const authClient = await initializeGooglePlayClient();

    const url = `${GOOGLE_PLAY_API_BASE}/applications/${packageName}/purchases/subscriptions/${subscriptionId}/tokens/${purchaseToken}`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${await getGoogleAccessToken(authClient)}`,
      },
    });

    return {
      purchaseHistory: [response.data],
      lastPurchaseData: response.data,
    };
  } catch (error: any) {
    console.error('Failed to get subscription history:', error.message);
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Failed to retrieve subscription history',
    );
  }
};
/**
 * Check if subscription is still active
 */
const checkSubscriptionStatus = async (
  packageName: string,
  subscriptionId: string,
  purchaseToken: string,
): Promise<any> => {
  try {
    const purchaseData = await verifyGooglePlayPurchase(
      packageName,
      // subscriptionId,
      purchaseToken,
    );

    const expiryTime = new Date(parseInt(purchaseData.expiryTimeMillis));
    const isActive = expiryTime > new Date() && purchaseData.paymentState === 1;

    return {
      isActive,
      autoRenewing: purchaseData.autoRenewing,
      expiryDate: expiryTime.toISOString(),
      dayUntilExpiry: Math.ceil(
        (expiryTime.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ),
      orderId: purchaseData.orderId,
    };
  } catch (error: any) {
    console.error('Error checking subscription status:', error.message);
    throw error;
  }
};

/**
 * Acknowledge a purchase
 * Required for new purchases to prevent cancellation
 */
const acknowledgePurchase = async (
  packageName: string,
  subscriptionId: string,
  purchaseToken: string,
): Promise<void> => {
  try {
    const authClient = await initializeGooglePlayClient();

    const url = `${GOOGLE_PLAY_API_BASE}/applications/${packageName}/purchases/subscriptions/${subscriptionId}/tokens/${purchaseToken}:acknowledge`;

    await axios.post(
      url,
      {},
      {
        headers: {
          Authorization: `Bearer ${await getGoogleAccessToken(authClient)}`,
        },
      },
    );

    console.log('✅ Purchase acknowledged successfully');
  } catch (error: any) {
    console.error('Failed to acknowledge purchase:', error.message);
    // Don't throw here - acknowledging is optional
  }
};

/**
 * Cancel a subscription
 */
const cancelSubscription = async (
  packageName: string,
  subscriptionId: string,
  purchaseToken: string,
): Promise<void> => {
  try {
    const authClient = await initializeGooglePlayClient();

    const url = `${GOOGLE_PLAY_API_BASE}/applications/${packageName}/purchases/subscriptions/${subscriptionId}/tokens/${purchaseToken}:cancel`;

    await axios.post(
      url,
      {},
      {
        headers: {
          Authorization: `Bearer ${await getGoogleAccessToken(authClient)}`,
        },
      },
    );

    console.log('✅ Subscription cancelled successfully');
  } catch (error: any) {
    console.error('Failed to cancel subscription:', error.message);
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Failed to cancel subscription: ' + error.message,
    );
  }
};

export const googleIAPService = {
  verifyGooglePlayPurchase,
  validateSubscriptionId,
  getSubscriptionPurchaseHistory,
  checkSubscriptionStatus,
  acknowledgePurchase,
  cancelSubscription,
};
