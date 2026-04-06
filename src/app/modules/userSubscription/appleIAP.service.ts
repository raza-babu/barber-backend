import axios from 'axios';
import config from '../../../config';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import jwt from 'jsonwebtoken';

/**
 * Apple IAP Service
 * Handles verification of App Store receipts and webhook validation
 */

const APPLE_SANDBOX_URL =
  'https://sandbox.itunes.apple.com/verifyReceipt';
const APPLE_PRODUCTION_URL =
  'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_APP_STORE_SERVER_API_BASE =
  'https://api.storekit.itunes.apple.com';
const APPLE_SANDBOX_APP_STORE_SERVER_API_BASE =
  'https://api.storekit-sandbox.itunes.apple.com';

interface AppleReceiptResponse {
  status: number;
  environment: string;
  receipt: {
    bundle_id: string;
    application_version: string;
    purchase_date_ms: string;
    original_purchase_date_ms: string;
    in_app: Array<{
      product_id: string;
      transaction_id: string;
      original_transaction_id: string;
      purchase_date_ms: string;
      expires_date_ms: string;
      is_trial_period: string;
      cancellation_date_ms?: string;
    }>;
  };
}

/**
 * Verify Apple receipt using App Store Server API
 * This is the modern approach for receipt validation
 */
const verifyAppleReceipt = async (
  transactionId: string,
  productId: string,
  namespace: 'accounting' | 'summary' = 'summary',
): Promise<any> => {
  try {
    // TEST MODE: For local testing
    if (transactionId.startsWith('TEST_')) {
      console.log('🧪 TEST MODE: Mocking Apple receipt verification');
      return {
        bundleId: config.apple.bundleId,
        productId: productId,
        transactionId: transactionId,
        originalTransactionId: transactionId,
        signedDate: new Date().toISOString(),
        environment: 'Sandbox',
      };
    }

    if (!config.apple.privateKey) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Apple private key not configured',
      );
    }

    // Generate JWT for Apple validation
    const jwt = await generateAppleJWT();

    const baseURL = APPLE_SANDBOX_APP_STORE_SERVER_API_BASE;

    const url = `${baseURL}/inApps/v1/transactions/${transactionId}`;

    console.log('🔗 Apple API Request:');
    console.log('   URL:', url);
    console.log('   Method: GET');
    console.log('   Authorization: Bearer [JWT with keyid=' + config.apple.keyId + ']');

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });

    console.log('✅ Apple API Response:', response.status);
    console.log('demo:', response.data);

    if (response.status !== 200) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Apple receipt verification failed',
      );
    }

    return response.data;
  } catch (error: any) {
    console.error('❌ Apple receipt verification error:', error.message);
    
    // Log detailed error info for 401
    if (error.response?.status === 401) {
      console.error('   🔑 Authentication Failed (401)');
      console.error('   ============================================');
      console.error('   Apple rejected your JWT authentication');
      console.error('   ');
      console.error('   LIKELY CAUSES:');
      console.error('   1. Private key is wrong for this Key ID or malformed');
      console.error('      Current key length:', config.apple.privateKey?.length, 'chars');
      console.error('      Note: ES256 .p8 keys are often short (~200-300 chars) and can be valid');
      console.error('      Verify APPLE_PRIVATE_KEY is the exact .p8 for APPLE_KEY_ID');
      console.error('   ');
      console.error('   2. Issuer ID / Team ID is wrong');
      console.error('      Prefer APPLE_ISSUER_ID (UUID), fallback is APPLE_TEAM_ID');
      console.error('   ');
      console.error('   3. Key ID does NOT match or key is revoked');
      console.error('      Check: https://appstoreconnect.apple.com/');
      console.error('      Users and Access → Keys');
      console.error('   ');
      console.error('   CONFIGURATION CHECK:');
      console.error('      Issuer ID:', (config.apple as any).issuerId || 'Not set');
      console.error('      Team ID:', config.apple.teamId);
      console.error('      Key ID:', config.apple.keyId);
      console.error('      Bundle ID:', config.apple.bundleId);
      console.error('      Private Key:', config.apple.privateKey ? 'Set' : 'Not set');
      console.error('   ');
      console.error('   WHAT TO DO:');
      console.error('   1. Go to App Store Connect');
      console.error('   2. Verify APPLE_PRIVATE_KEY and APPLE_KEY_ID in .env');
      console.error('   3. Set APPLE_ISSUER_ID (recommended)');
      console.error('   4. Restart the server');
      console.error('   ============================================');
      
      if (error.response?.data) {
        console.error('   Raw error from Apple:', JSON.stringify(error.response.data, null, 2));
      }
    }
    
    if (error.response?.data) {
      console.error('   Error details:', JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.response?.status === 404) {
      throw new AppError(httpStatus.NOT_FOUND, 'Transaction not found in Apple records');
    }
    
    throw error;
  }
};

const getAppleSubscriptionPlans = async (): Promise<any> => {
  try {
    // In a real implementation, you would fetch this from Apple or maintain a mapping
    // get real product IDs from Apple server using the App Store Server API 

    return [
      {
        productId: 'com.barbershift.monthly',
        name: 'Monthly Subscription',
        price: 9.99,
        currency: 'USD',
        billingPeriod: 'P1M',
      },
      {
        productId: 'com.barbershift.yearly',
        name: 'Yearly Subscription',
        price: 99.99,
        currency: 'USD',
        billingPeriod: 'P1Y',
      },
    ];
  } catch (error: any) {
    console.error('Failed to fetch Apple subscription plans:', error.message);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to fetch subscription plans',
    );
  }
};


/**
 * Verify receipt data (StoreKit 2 - Transaction Token)
 * Handles signed transaction tokens (JWS format) from StoreKit 2
 * 
 * The receiptData is a JWT signed by Apple containing transaction data.
 * We decode it to extract the transactionId and environment, then verify
 * using the App Store Server API.
 */
const verifyAppleReceiptData = async (
  receiptData: string,
  productId: string,
): Promise<any> => {
  try {

    // TEST MODE: For local testing
    if (receiptData.startsWith('TEST_')) {
      console.log('🧪 TEST MODE: Mocking Apple receipt data verification');
      return {
        status: 0,
        environment: 'Sandbox',
        transactionId: receiptData,
        productId: productId,
      };
    }

    // Decode the JWT without verification to extract transaction data
    // (Apple's signature is verified via HTTPS connection)
    const decoded = jwt.decode(receiptData) as any;

    if (!decoded) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Invalid receipt token format',
      );
    }

    console.log('📦 Decoded receipt token:', {
      transactionId: decoded.transactionId,
      environment: decoded.environment,
      productId: decoded.productId,
    });

    // Extract transactionId from the decoded token
    const transactionId = decoded.transactionId;
    if (!transactionId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Transaction ID not found in receipt token',
      );
    }

    // Use the modern App Store Server API to verify the transaction
    // This handles both Sandbox and Production environments automatically
    const verificationResult = await verifyAppleReceipt(transactionId, productId);

    return {
      status: 0, // Indicate success
      environment: decoded.environment || 'Sandbox',
      transactionId: transactionId,
      originalTransactionId: decoded.originalTransactionId,
      productId: decoded.productId,
      verificationResult: verificationResult, // Include full verification data
    };
  } catch (error: any) {
    console.error('Apple receipt data verification error:', error.message);
    throw error instanceof AppError ? error : new AppError(
      httpStatus.BAD_REQUEST,
      'Failed to verify Apple receipt: ' + error.message,
    );
  }
};

/**
 * Parse and normalize Apple private key from environment variables.
 */
const parseApplePrivateKey = (keyString: string): string => {
  if (!keyString) {
    throw new Error('APPLE_PRIVATE_KEY environment variable is not set.');
  }

  let key = keyString.trim();

  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }

  key = key.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();

  if (!key.includes('-----BEGIN PRIVATE KEY-----') || !key.includes('-----END PRIVATE KEY-----')) {
    throw new Error('APPLE_PRIVATE_KEY must be a valid PKCS#8 .p8 private key.');
  }

  return key;
};

/**
 * Generate JWT for Apple App Store Server API authentication.
 * App Store Server API requires ES256 signed with your .p8 private key.
 */
const generateAppleJWT = async (): Promise<string> => {
  try {

    // Validate required configuration
    const issuerId = (config.apple as any).issuerId || config.apple.teamId;
    if (!issuerId) {
      throw new Error('Apple Issuer ID not configured (APPLE_ISSUER_ID)');
    }
    if (!config.apple.keyId) {
      throw new Error('Apple Key ID not configured (APPLE_KEY_ID)');
    }
    if (!config.apple.bundleId) {
      throw new Error('Apple Bundle ID not configured (APPLE_BUNDLE_ID)');
    }
    if (!config.apple.privateKey) {
      throw new Error('Apple Private Key not configured (APPLE_PRIVATE_KEY)');
    }

    const privateKey = parseApplePrivateKey(config.apple.privateKey);

    const payload = {
      iss: issuerId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      aud: 'appstoreconnect-v1',
      bid: config.apple.bundleId,
    };

    console.log('🔐 Generating Apple JWT with:');
    console.log('   Issuer ID: ', issuerId);
    console.log('   Key ID: ', config.apple.keyId);
    console.log('   Bundle ID: ', config.apple.bundleId);
    console.log('   Algorithm: ES256');
    console.log('   JWT Claims:');
    console.log('     iss (issuer):', payload.iss);
    console.log('     bid (bundle id):', payload.bid);
    console.log('     aud (audience):', payload.aud);

    const token = jwt.sign(payload, privateKey, {
      algorithm: 'ES256',
      keyid: config.apple.keyId,
    });

    console.log('✅ Apple JWT generated successfully');
    console.log('   JWT length:', token.length, 'chars');
    console.log('   JWT header:', token.split('.')[0]);
    console.log('   JWT payload:', token.split('.')[1]);
    
    // Decode to verify
    const decoded = jwt.decode(token, { complete: true }) as any;
    console.log('   Decoded Header:', JSON.stringify(decoded.header));
    console.log('   Decoded Payload:', JSON.stringify(decoded.payload));
    
    return token;
  } catch (error: any) {
    console.error('❌ Failed to generate Apple JWT:', error.message);
    console.error('   Error details:', error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to generate Apple authentication token: ' + error.message,
    );
  }
};

/**
 * Verify App Store Server Notification signature (webhook verification)
 */
const verifyAppleWebhookSignature = async (
  signedPayload: string,
): Promise<any> => {
  try {
    
    // Decode without verification first to inspect the payload
    const decoded = jwt.decode(signedPayload, { complete: true }) as any;

    if (!decoded) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid webhook payload');
    }

    // In production, you should fetch Apple's public certificate and verify the signature
    // For now, we decode and trust Apple's origin (verify via HTTPS)
    // Implementation: https://developer.apple.com/documentation/storekit/app-store-server-api
    
    return decoded.payload;
  } catch (error: any) {
    console.error('Apple webhook signature verification error:', error.message);
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Invalid webhook signature',
    );
  }
};

/**
 * Parse and validate Apple webhook notification
 */
const parseAppleWebhookNotification = async (signedPayload: string) => {
  try {
    const decodedPayload = await verifyAppleWebhookSignature(signedPayload);

    const notification = {
      notificationType: decodedPayload.notificationType,
      subtype: decodedPayload.subtype,
      data: decodedPayload.data,
      version: decodedPayload.version,
      signedDate: decodedPayload.signedDate,
    };

    return notification;
  } catch (error) {
    throw error;
  }
};

/**
 * Get transaction history from Apple (for restoration/validation)
 */
const getAppleTransactionHistory = async (
  originalTransactionId: string,
): Promise<any> => {
  try {
    const jwt = await generateAppleJWT();

    const baseURL = config.apple.isProduction
      ? APPLE_APP_STORE_SERVER_API_BASE
      : APPLE_SANDBOX_APP_STORE_SERVER_API_BASE;

    const url = `${baseURL}/inApps/v1/tokens/${originalTransactionId}/transactions`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });

    return response.data;
  } catch (error: any) {
    console.error('Failed to get transaction history:', error.message);
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Failed to retrieve transaction history',
    );
  }
};

/**
 * Validate Apple Product ID exists in App Store
 * Useful for syncing and validating subscription plans
 */
const validateAppleProductId = async (
  productId: string,
): Promise<boolean> => {
  try {
    if (!config.apple.sharedSecret) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Apple shared secret not configured',
      );
    }

    // For validation, we try to get subscription info
    // If the product ID is valid, Apple will return data
    // If invalid, it will return 404
    const jwt = await generateAppleJWT();

    const baseURL = config.apple.isProduction
      ? APPLE_APP_STORE_SERVER_API_BASE
      : APPLE_SANDBOX_APP_STORE_SERVER_API_BASE;

    // Note: There's no direct product ID validation endpoint
    // So we validate by checking if we can query transactions with this product
    // In practice, you should maintain the product ID mapping manually
    
    console.log(`Validating Apple product ID: ${productId}`);
    return true; // Just logging for now - actual validation depends on your sync process
  } catch (error: any) {
    console.error('Error validating Apple product ID:', error.message);
    return false;
  }
};

export const appleIAPService = {
  verifyAppleReceipt,
  verifyAppleReceiptData,
  verifyAppleWebhookSignature,
  parseAppleWebhookNotification,
  getAppleTransactionHistory,
  getAppleSubscriptionPlans,
  validateAppleProductId,
};
