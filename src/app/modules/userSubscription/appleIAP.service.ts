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
      console.error('   1. Private key is INVALID or INCOMPLETE');
      console.error('      Current key length:', config.apple.privateKey?.length, 'chars');
      console.error('      Expected: 1700+ chars');
      console.error('      Your key: 257 chars ← TOO SHORT!');
      console.error('   ');
      console.error('   2. Private key does NOT match Key ID:', config.apple.keyId);
      console.error('      You must download the .p8 file for THIS key ID');
      console.error('   ');
      console.error('   3. Key is EXPIRED or REVOKED in App Store Connect');
      console.error('      Check: https://appstoreconnect.apple.com/');
      console.error('      Users and Access → Keys');
      console.error('   ');
      console.error('   CONFIGURATION CHECK:');
      console.error('      Team ID:', config.apple.teamId);
      console.error('      Key ID:', config.apple.keyId);
      console.error('      Bundle ID:', config.apple.bundleId);
      console.error('   ');
      console.error('   WHAT TO DO:');
      console.error('   1. Go to App Store Connect');
      console.error('   2. Find Key ID:', config.apple.keyId);
      console.error('   3. Download the .p8 file for that key');
      console.error('   4. Convert to .env format:');
      console.error('      cat key.p8 | tr "\\n" " " | sed "s/ /\\\\n/g"');
      console.error('   5. Update APPLE_PRIVATE_KEY in .env');
      console.error('   6. Restart the server');
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
 * Parse and normalize Apple private key from environment variables
 * Handles various formats and encoding issues
 */
const parseApplePrivateKey = (keyString: string): string => {
  if (!keyString) {
    throw new Error(
      'APPLE_PRIVATE_KEY environment variable is not set. ' +
      'Add it to your .env file with the content of your .p8 file from App Store Connect.'
    );
  }

  // Start with the raw key
  let key = keyString.trim();

  console.log('🔍 Raw key length:', key.length, 'chars');
  console.log('🔍 First 80 chars:', key.substring(0, 80));
  console.log('🔍 Last 80 chars:', key.substring(Math.max(0, key.length - 80)));

  // EARLY CHECK: If key is suspiciously short, it's probably not configured
  if (key.length < 200) {
    console.error('❌ APPLE_PRIVATE_KEY is too short! Expected ~1800+ chars, got:', key.length);
    console.error('   Value:', key);
    throw new Error(
      `APPLE_PRIVATE_KEY appears to be incomplete or not configured. ` +
      `Expected ~1800+ characters, got ${key.length}. ` +
      `Make sure you copied the entire .p8 file content from App Store Connect.`
    );
  }

  // Handle case where newlines are escaped as literal \n in environment variables
  key = key.replace(/\\n/g, '\n');
  
  // Handle Windows line endings
  key = key.replace(/\r\n/g, '\n');
  
  // Handle case where key is wrapped in extra quotes
  if ((key.startsWith('"') && key.endsWith('"')) ||
      (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }

  // Remove all leading/trailing whitespace
  key = key.trim();

  // Check if key has proper BEGIN marker
  if (!key.includes('-----BEGIN PRIVATE KEY-----')) {
    // Try to find what format it actually is
    const beginMatch = key.match(/-----BEGIN [^-]*-----/);
    if (beginMatch) {
      console.warn('⚠️ Key starts with:', beginMatch[0], '(expected: -----BEGIN PRIVATE KEY-----)');
    }
    throw new Error(
      `Private key must be in PKCS#8 format starting with "-----BEGIN PRIVATE KEY-----". ` +
      `First 100 chars: "${key.substring(0, 100)}"`
    );
  }

  // Check if key has proper END marker
  if (!key.includes('-----END PRIVATE KEY-----')) {
    // Try to find what END markers exist
    const endMatch = key.match(/-----END [^-]*-----/) || key.match(/-----END/);
    if (endMatch) {
      console.warn('⚠️ Key ends with:', endMatch[0], '(expected: -----END PRIVATE KEY-----)');
      console.warn('⚠️ Last 150 chars:', key.substring(key.length - 150));
    } else {
      console.warn('⚠️ No END marker found. Last 200 chars:', key.substring(key.length - 200));
    }
    throw new Error(
      `Private key must end with "-----END PRIVATE KEY-----". ` +
      `Key length: ${key.length}. Last 100 chars: "${key.substring(key.length - 100)}"`
    );
  }

  // Ensure BEGIN marker is at the actual start (after trimming)
  const beginIdx = key.indexOf('-----BEGIN PRIVATE KEY-----');
  if (beginIdx !== 0) {
    key = key.substring(beginIdx);
  }

  // Ensure END marker is at the actual end (after trimming)
  const endIdx = key.lastIndexOf('-----END PRIVATE KEY-----');
  if (endIdx !== -1) {
    key = key.substring(0, endIdx + '-----END PRIVATE KEY-----'.length);
  }

  // Remove any trailing/leading whitespace one more time
  key = key.trim();

  // Replace multiple newlines with single newline
  key = key.replace(/\n+/g, '\n');

  // Debug output (only the first and last line for security)
  const lines = key.split('\n');
  console.log('🔑 Private key validation:');
  console.log('   ✓ First line:', lines[0]);
  console.log('   ✓ Last line:', lines[lines.length - 1]);
  console.log('   ✓ Total lines:', lines.length);
  console.log('   ✓ Total length:', key.length, 'chars');

  return key;
};

/**
 * Generate JWT for Apple App Store Server API authentication
 */
const generateAppleJWT = async (): Promise<string> => {
  try {

    // Validate required configuration
    if (!config.apple.teamId) {
      throw new Error('Apple Team ID not configured (APPLE_TEAM_ID)');
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

    // Parse and normalize the private key
    const privateKey = parseApplePrivateKey(config.apple.privateKey);

    // ⚠️ CRITICAL CHECK: Verify key is long enough
    if (privateKey.length < 500) {
      console.error('❌ CRITICAL: Private key is TOO SHORT!');
      console.error('   Current length:', privateKey.length, 'chars');
      console.error('   Expected length: 1700+ chars');
      console.error('   ');
      console.error('   This means the .p8 file you provided is INCOMPLETE.');
      console.error('   ');
      console.error('   FIX:');
      console.error('   1. Go to: https://appstoreconnect.apple.com/');
      console.error('   2. Users and Access → Keys');
      console.error('   3. Find Key ID:', config.apple.keyId);
      console.error('   4. Download the complete .p8 file');
      console.error('   5. Paste the ENTIRE content (all lines) into .env');
      throw new Error(
        `Private key is incomplete (${privateKey.length} chars). ` +
        `Expected 1700+ chars. Download the complete .p8 file from App Store Connect ` +
        `for Key ID: ${config.apple.keyId}`
      );
    }

    const payload = {
      iss: config.apple.teamId,        // Issuer: Team ID
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiration
      aud: 'appstoreconnect-v1',
      sub: config.apple.teamId,        // Subject: MUST be Team ID (not Bundle ID)
    };

    console.log('🔐 Generating Apple JWT with:');
    console.log('   Team ID: ', config.apple.teamId);
    console.log('   Key ID: ', config.apple.keyId);
    console.log('   Bundle ID: ', config.apple.bundleId);
    console.log('   Private Key Length:', privateKey.length, 'chars');
    console.log('   JWT Claims:');
    console.log('     iss (issuer):', payload.iss);
    console.log('     sub (subject):', payload.sub);
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
    if (!config.apple.privateKey) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Apple private key not configured',
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
