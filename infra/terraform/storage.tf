# --- Media: covers, avatars and submissions (SRS §5 object storage, ADR 0006) ----------------
# Private, except anonymous GET under public/ (profile and cover images). Uploads go straight
# from the app with presigned POSTs; abandoned multipart uploads are cleaned up.

resource "aws_s3_bucket" "media" {
  bucket_prefix = "feedants-${var.environment}-media-"
}

resource "aws_s3_bucket_ownership_controls" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    object_ownership = "BucketOwnerEnforced" # no ACLs
  }
}

# Anonymous GET under public/ is the design (ADR 0006); everything else stays private.
#trivy:ignore:AWS-0087
#trivy:ignore:AWS-0093
resource "aws_s3_bucket_public_access_block" "media" {
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = false # needed for the public/ prefix policy below
  restrict_public_buckets = false
}

# SSE-S3: encrypted at rest without a $1/month CMK per bucket; revisit if key-level audit is needed.
#trivy:ignore:AWS-0132
resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

data "aws_iam_policy_document" "media" {
  statement {
    sid       = "PublicReadForPublicPrefix"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.media.arn}/public/*"]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
  }

  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.media.arn, "${aws_s3_bucket.media.arn}/*"]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "media" {
  bucket     = aws_s3_bucket.media.id
  policy     = data.aws_iam_policy_document.media.json
  depends_on = [aws_s3_bucket_public_access_block.media]
}

resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  cors_rule {
    allowed_methods = ["POST", "GET"]
    allowed_origins = length(var.cors_origins) > 0 ? var.cors_origins : ["*"]
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

# --- Backups: nightly database dumps (US-39) -----------------------------------------------
# Private and versioned. The host can add backups but not delete them (iam.tf); the lifecycle
# rule expires them after backup_retention_days.

resource "aws_s3_bucket" "backups" {
  bucket_prefix = "feedants-${var.environment}-backups-"
}

resource "aws_s3_bucket_ownership_controls" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket                  = aws_s3_bucket.backups.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

#trivy:ignore:AWS-0132 SSE-S3, as for media.
resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket     = aws_s3_bucket.backups.id
  depends_on = [aws_s3_bucket_versioning.backups]

  rule {
    id     = "expire-old-backups"
    status = "Enabled"
    filter {
      prefix = "postgres/"
    }
    expiration {
      days = var.backup_retention_days
    }
    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }
}

data "aws_iam_policy_document" "backups" {
  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.backups.arn, "${aws_s3_bucket.backups.arn}/*"]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "backups" {
  bucket     = aws_s3_bucket.backups.id
  policy     = data.aws_iam_policy_document.backups.json
  depends_on = [aws_s3_bucket_public_access_block.backups]
}
