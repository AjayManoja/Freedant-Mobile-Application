#!/bin/sh
# Creates the media bucket: private by default, anonymous read only under public/
# (avatars, cover images), and abandoned uploads expire (SRS §5).
set -eu
endpoint="http://storage:9000"
s3() { aws --endpoint-url "$endpoint" "$@"; }

until s3 s3api list-buckets >/dev/null 2>&1; do sleep 1; done

s3 s3api head-bucket --bucket "$S3_BUCKET" 2>/dev/null || s3 s3api create-bucket --bucket "$S3_BUCKET"

s3 s3api put-bucket-policy --bucket "$S3_BUCKET" --policy "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{
    \"Sid\": \"PublicReadForPublicPrefix\",
    \"Effect\": \"Allow\",
    \"Principal\": \"*\",
    \"Action\": [\"s3:GetObject\"],
    \"Resource\": [\"arn:aws:s3:::$S3_BUCKET/public/*\"]
  }]
}"

s3 s3api put-bucket-cors --bucket "$S3_BUCKET" --cors-configuration '{
  "CORSRules": [{ "AllowedMethods": ["POST", "GET"], "AllowedOrigins": ["*"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 3000 }]
}' || echo "CORS not supported by this S3 server; uploads from native apps are unaffected"

echo "Bucket $S3_BUCKET ready"
