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
    const credentials = config.google?.credentials;
    
    if (!credentials) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Google IAP credentials not configured',
      );
    }

    let parsedCredentials;
    try {
      parsedCredentials = JSON.parse(credentials);
    } catch (parseError: any) {
      console.error('❌ Failed to parse Google credentials JSON:', parseError.message);
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

/**
 * Verify Google Play purchase token
 * Validates the purchase against Google Play's backend
 */
const verifyGooglePlayPurchase = async (
  packageName: string,
  subscriptionId: string,
  purchaseToken: string,
): Promise<any> => {
  try {
    // Get authenticated client
    const authClient = await initializeGooglePlayClient();

    console.log('🔗 Google Play API Request:');
    console.log(
      '   URL: /purchases/subscriptions/{subscriptionId}/tokens/{purchaseToken}',
    );
    console.log('   Package Name:', packageName);
    console.log('   Subscription ID:', subscriptionId);
    console.log('   Method: GET');

    // Make request to Google Play API
    const url = `${GOOGLE_PLAY_API_BASE}/applications/${packageName}/purchases/subscriptions/${subscriptionId}/tokens/${purchaseToken}`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${await getGoogleAccessToken(authClient)}`,
      },
    });

    console.log('✅ Google Play API Response:', response.status);
    console.log('Purchase Data:', {
      orderId: response.data.orderId,
      autoRenewing: response.data.autoRenewing,
      paymentState: response.data.paymentState,
      expiryTime: new Date(parseInt(response.data.expiryTimeMillis)),
    });

    if (response.status !== 200) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Google Play purchase verification failed',
      );
    }

    // Validate purchase state (1 = Purchased)
    if (response.data.paymentState !== 1) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Invalid purchase state. Payment not completed.',
      );
    }

    // Check if subscription is still valid
    const expiryTime = new Date(parseInt(response.data.expiryTimeMillis));
    if (expiryTime < new Date()) {
      console.warn('⚠️ Subscription has expired:', expiryTime);
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Subscription has expired. Please renew.',
      );
    }

    return {
      ...response.data,
      isValid: true,
      expiryDate: expiryTime.toISOString(),
      startDate: new Date(
        parseInt(response.data.startTimeMillis),
      ).toISOString(),
    };
  } catch (error: any) {
    console.error('❌ Google Play purchase verification error:', error.message);

    // Log detailed error info
    if (error.response?.status === 400) {
      console.error('   ❌ Bad Request (400)');
      console.error(
        '   Invalid package name, subscription ID, or purchase token',
      );
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Invalid purchase details. Please verify package name, subscription ID, and purchase token.',
      );
    }

    if (error.response?.status === 401) {
      console.error('   🔑 Authentication Failed (401)');
      console.error('   Google IAP credentials are invalid or expired');
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        'Google IAP authentication failed. Please contact support.',
      );
    }

    if (error.response?.status === 404) {
      console.error('   ❌ Not Found (404)');
      console.error('   Purchase token not found in Google Play records');
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Purchase not found. The purchase token may be invalid or expired.',
      );
    }

    throw error instanceof AppError
      ? error
      : new AppError(
          httpStatus.BAD_REQUEST,
          'Google Play purchase verification failed: ' + error.message,
        );
  }
};

/**
 * Get Google access token from authenticated client
 */
const getGoogleAccessToken = async (authClient: any): Promise<string> => {
  try {
    const { credentials } = await authClient.getAccessToken();
    if (!credentials.access_token) {
      throw new Error('Failed to obtain access token');
    }
    return credentials.access_token;
  } catch (error: any) {
    console.error('❌ Failed to get Google access token:', error.message);
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
    value => value.toLowerCase() === lowerInput
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
      subscriptionId,
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
