#!/usr/bin/env python3
import os
import subprocess

# Define the safe version of the file
safe_content = '''import config from "../../config";

export const serviceAccount = {
  // "type": "service_account",
  "project_id": config.firebase.project_id,
  "private_key_id": config.firebase.private_key_id,
  "private_key": config.firebase.private_key,
  "client_email": config.firebase.client_email,
  // "client_id": "111125017684229976110",
  // "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  // "token_uri": "https://oauth2.googleapis.com/token",
  // "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  // "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40barber-9cf6a.iam.gserviceaccount.com",
  // "universe_domain": "googleapis.com"
  
}
'''

# Run git filter-branch to replace the file in all commits
file_path = "src/app/utils/serviceAccount.ts"
os.chdir("c:\\efaz\\Barber Shift App - Copy")

# First, let's clean up any previous filter-branch attempts
os.system("git filter-branch -f --prune-empty --tree-filter 'if [ -f %s ]; then cat > %s << \"EOF\"\n%s\nEOF\nfi' -- --all 2>/dev/null || true" % (file_path, file_path, safe_content))

print("Script completed")
