variable "region" {
  description = "AWS region for everything (Mumbai: closest to the users, A-31)."
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Environment name; also the SSM path segment (/feedants/<environment>/) and the instance's Name tag suffix."
  type        = string
  default     = "production"
}

variable "instance_type" {
  description = "EC2 type for the single host. 4 GiB fits the stack's memory limits with headroom (HLD §4)."
  type        = string
  default     = "t3.medium"
}

variable "root_volume_gb" {
  description = "Root volume size: Docker images, Postgres, Prometheus (2 GB cap) and logs."
  type        = number
  default     = 30
}

variable "domain_name" {
  description = "Public API hostname, e.g. api.feedants.example. TLS is issued for it by Let's Encrypt."
  type        = string
}

variable "route53_zone_id" {
  description = "Hosted zone to create the A record in. Empty: create the record by hand from the elastic_ip output."
  type        = string
  default     = ""
}

variable "acme_email" {
  description = "Contact address for Let's Encrypt expiry notices."
  type        = string
}

variable "github_repository" {
  description = "owner/name of the GitHub repository: source of release files, and the only repo the deploy role trusts."
  type        = string
  default     = "AjayManoja/Freedant-Mobile-Application"
}

variable "create_github_oidc_provider" {
  description = "Create the GitHub Actions OIDC provider. Set false if the account already has one."
  type        = bool
  default     = true
}

variable "budget_monthly_usd" {
  description = "Monthly cost budget; alerts at 80 % actual and 100 % forecast."
  type        = number
  default     = 40
}

variable "budget_alert_email" {
  description = "Who receives budget alerts."
  type        = string
}

variable "backup_retention_days" {
  description = "How long nightly database backups are kept (NFR-RL-07)."
  type        = number
  default     = 30
}

variable "cors_origins" {
  description = "Origins allowed to call the API from a browser (the Expo web export)."
  type        = list(string)
  default     = []
}
