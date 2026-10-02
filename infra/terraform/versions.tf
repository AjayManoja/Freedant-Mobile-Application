terraform {
  # 1.10+ for S3-native state locking (use_lockfile), so no DynamoDB table is needed.
  required_version = ">= 1.10, < 2.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Partial configuration: the bucket is account-specific, so it is passed at init time:
  #   terraform init -backend-config=backend.hcl   (see backend.hcl.example)
  backend "s3" {
    key          = "feedants/terraform.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = "feedants"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
