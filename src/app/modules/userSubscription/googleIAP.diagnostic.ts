import config from '../../../config';

/**
 * Diagnostic utility for Google IAP configuration
 * Run this on server startup to verify credentials are valid
 */

export const validateGoogleIAPConfig = () => {
  console.log('\n🔍 Checking Google IAP Configuration...\n');

  // Check 1: Package name
  if (!config.google?.packageName) {
    console.error('❌ GOOGLE_PACKAGE_NAME not configured');
    console.error('   Add to .env: GOOGLE_PACKAGE_NAME=com.barberstime.barber_time_app\n');
    return false;
  }
  console.log('✅ Package Name:', config.google.packageName);

  // Check 2: Credentials existence
  if (!config.google?.credentials) {
    console.error('❌ GOOGLE_IAP_CREDENTIALS not configured');
    console.error('   Add to .env: GOOGLE_IAP_CREDENTIALS={...service account JSON...}\n');
    return false;
  }
  console.log('✅ Credentials: Configured (length: ' + config.google.credentials.length + ')');

  // Check 3: Valid JSON
  let parsedCredentials;
  try {
    parsedCredentials = JSON.parse(config.google.credentials);
    console.log('✅ Credentials: Valid JSON');
  } catch (error: any) {
    console.error('❌ Credentials: Invalid JSON -', error.message);
    console.error('   The GOOGLE_IAP_CREDENTIALS must be valid JSON\n');
    return false;
  }

  // Check 4: Required fields in credentials
  const requiredFields = [
    'type',
    'project_id',
    'private_key_id',
    'private_key',
    'client_email',
    'client_id',
    'auth_uri',
    'token_uri',
  ];

  const missingFields = requiredFields.filter(field => !parsedCredentials[field]);
  if (missingFields.length > 0) {
    console.error('❌ Credentials: Missing required fields:', missingFields.join(', '));
    console.error('   Credentials must include all service account fields\n');
    return false;
  }
  console.log('✅ Credentials: All required fields present');
  console.log('   Project ID:', parsedCredentials.project_id);
  console.log('   Service Account:', parsedCredentials.client_email);

  // Check 5: Private key format
  if (!parsedCredentials.private_key.includes('BEGIN RSA PRIVATE KEY') &&
      !parsedCredentials.private_key.includes('BEGIN PRIVATE KEY')) {
    console.error('❌ Credentials: Invalid private key format');
    console.error('   Private key must start with BEGIN RSA PRIVATE KEY or BEGIN PRIVATE KEY\n');
    return false;
  }
  console.log('✅ Credentials: Private key format valid');

  console.log('\n✅ Google IAP Configuration: OK\n');
  return true;
};

/**
 * Print configuration diagnostics
 * Call this if you encounter authentication errors
 */
export const printGoogleIAPDiagnostics = () => {
  console.log('\n📋 Google IAP Configuration Diagnostics\n');
  console.log('Package Name:', config.google?.packageName || 'NOT SET');
  console.log('Credentials Set:', !!config.google?.credentials);
  
  if (config.google?.credentials) {
    try {
      const creds = JSON.parse(config.google.credentials);
      console.log('Credentials Type:', creds.type);
      console.log('Project ID:', creds.project_id);
      console.log('Service Account:', creds.client_email);
    } catch (error: any) {
      console.error('⚠️ Credentials Error:', error.message);
    }
  }
  
  console.log('\n');
};

/**
 * Example .env configuration
 */
export const EXAMPLE_ENV = `
# Google Play IAP Configuration
GOOGLE_PACKAGE_NAME=com.barberstime.barber_time_app
GOOGLE_IAP_CREDENTIALS={"type":"service_account","project_id":"your-project-d","private_key_id":"key-id","private_key":"-----BEGIN RSA PRIVATE KEY-----\\n...\\n-----END RSA PRIVATE KEY-----\\n","client_email":"firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com","client_id":"123456789","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/..."}
`;
