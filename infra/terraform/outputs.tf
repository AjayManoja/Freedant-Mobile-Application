output "elastic_ip" {
  description = "Point the domain's A record here (done automatically when route53_zone_id is set)."
  value       = aws_eip.host.public_ip
}

output "instance_id" {
  description = "For SSM sessions and port forwarding: aws ssm start-session --target <id>."
  value       = aws_instance.host.id
}

output "media_bucket" {
  value = aws_s3_bucket.media.bucket
}

output "backup_bucket" {
  value = aws_s3_bucket.backups.bucket
}

output "deploy_role_arn" {
  description = "GitHub variable AWS_DEPLOY_ROLE_ARN for the deploy workflow."
  value       = aws_iam_role.deploy.arn
}

output "ssm_prefix" {
  description = "Where the services' settings live; see scripts/generate-secrets.sh."
  value       = local.ssm_prefix
}
