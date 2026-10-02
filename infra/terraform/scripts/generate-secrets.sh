#!/usr/bin/env bash
# Fills the generated secrets in SSM Parameter Store, once, after the first `terraform apply`.
# Only parameters still holding the CHANGE_ME placeholder are written, so running it again
# never rotates a live secret by accident. Values never pass through Terraform state.
#
#   ENVIRONMENT=production AWS_REGION=ap-south-1 infra/terraform/scripts/generate-secrets.sh
#
# Provider credentials (SMTP_*, RAZORPAY_*, MAIL_FROM, ALERT_EMAIL_*) are set by hand:
#   aws ssm put-parameter --overwrite --name /feedants/production/SMTP_PASSWORD --type SecureString --value '...'
set -euo pipefail

env=${ENVIRONMENT:-production}
region=${AWS_REGION:-ap-south-1}
prefix=/feedants/$env

current() {
  aws ssm get-parameter --region "$region" --name "$prefix/$1" --with-decryption \
    --query Parameter.Value --output text
}

put_if_placeholder() {
  local name=$1 value=$2
  if [[ $(current "$name") == CHANGE_ME ]]; then
    aws ssm put-parameter --region "$region" --name "$prefix/$name" --type SecureString \
      --overwrite --value "$value" >/dev/null
    echo "set      $name"
  else
    echo "kept     $name (already set)"
  fi
}

# Hex only: safe inside URLs (DATABASE_URL, RABBITMQ_URL) and single-quoted .env values.
random() { openssl rand -hex "$1"; }

for name in POSTGRES_PASSWORD IDENTITY_DB_PASSWORD COMPETITION_DB_PASSWORD PAYMENT_DB_PASSWORD \
  NOTIFICATION_DB_PASSWORD RABBITMQ_PASSWORD; do
  put_if_placeholder "$name" "$(random 24)"
done
put_if_placeholder INTERNAL_API_TOKEN "$(random 32)"
put_if_placeholder OTP_PEPPER "$(random 32)"

# RS256 signing key for access tokens (ADR 0005). Stored with real newlines; deploy.sh
# writes them as \n and Identity turns them back.
if [[ $(current JWT_PRIVATE_KEY) == CHANGE_ME ]]; then
  key=$(openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 2>/dev/null)
  put_if_placeholder JWT_PRIVATE_KEY "$key"
else
  echo "kept     JWT_PRIVATE_KEY (already set)"
fi

echo
echo "Still to set by hand (provider credentials and addresses):"
for name in SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASSWORD MAIL_FROM ALERT_EMAIL_TO ALERT_EMAIL_FROM \
  RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET; do
  [[ $(current "$name") == CHANGE_ME ]] && echo "  $prefix/$name"
done
true
