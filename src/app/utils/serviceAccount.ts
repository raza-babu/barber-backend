import config from "../../config";

export const serviceAccount = {
  // "type": "service_account",
  "project_id": config.firebase.project_id,
  "private_key_id": config.firebase.private_key_id,
  "private_key": config.firebase.private_key,
  "client_email": config.firebase.client_email,
  "client_id": config.firebase.client_id,
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": config.firebase.client_x509_cert_url,
  "universe_domain": "googleapis.com"
}

