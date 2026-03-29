import { time } from "console";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
  env: process.env.NODE_ENV,
  port: process.env.PORT,
  timezone: process.env.TIMEZONE,
  super_admin_password: process.env.SUPER_ADMIN_PASSWORD,
  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
  jwt: {
    access_secret: process.env.JWT_ACCESS_SECRET,
    access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN,
    refresh_secret: process.env.JWT_REFRESH_SECRET,
    refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN,
  },
  emailSender: {
    email: process.env.EMAIL,
    app_pass: process.env.APP_PASS,
  },
  s3: {
    do_space_endpoint: process.env.DO_SPACE_ENDPOINT,
    do_space_accesskey: process.env.DO_SPACE_ACCESS_KEY,
    do_space_secret_key: process.env.DO_SPACE_SECRET_KEY,
    do_space_bucket: process.env.DO_SPACE_BUCKET,
  },
  aws: {
    aws_access_key_id: process.env.AWS_ACCESS_KEY_ID,
    aws_secret_access_key: process.env.AWS_SECRET_ACCESS_KEY,
    aws_region: process.env.AWS_REGION,
    aws_s3_bucket: process.env.AWS_S3_BUCKET,
  },
  stripe: {
    stripe_secret_key: process.env.STRIPE_SECRET_KEY,
    stripe_webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  apple: {
    bundleId: process.env.APPLE_BUNDLE_ID,
    teamId: process.env.APPLE_TEAM_ID,
    keyId: process.env.APPLE_KEY_ID,
    privateKey: process.env.APPLE_PRIVATE_KEY,
    sharedSecret: process.env.APPLE_PRIVATE_KEY, // ✅ For receipt verification
    isProduction: process.env.NODE_ENV === 'production', // ✅ Fixed: should be 'production' not 'development'
  },
  google: {
    packageName: process.env.GOOGLE_PACKAGE_NAME || 'com.barberstime.barber_time_app',
    credentials: process.env.GOOGLE_IAP_CREDENTIALS, // JSON credential string from Google Play Console
    // Credentials structure should be:
    // {
    //   "type": "service_account",
    //   "project_id": "...",
    //   "private_key_id": "...",
    //   "private_key": "...",
    //   "client_email": "...",
    //   "client_id": "...",
    //   "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    //   "token_uri": "https://oauth2.googleapis.com/token",
    //   "auth_provider_x509_cert_url": "...",
    //   "client_x509_cert_url": "..."
    // }
  },
  backend_base_url: process.env.BACKEND_BASE_URL,
  frontend_base_url: process.env.FRONTEND_BASE_URL,
};
