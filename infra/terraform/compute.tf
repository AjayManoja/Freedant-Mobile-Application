# The single host (HLD §4, A-32). Docker Compose runs the whole stack; deploys arrive through
# SSM Run Command (no SSH, no inbound port besides 80/443).

data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

locals {
  registry = "ghcr.io/${lower(split("/", var.github_repository)[0])}"
}

resource "aws_instance" "host" {
  ami                    = data.aws_ssm_parameter.al2023.value
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.host.id]
  iam_instance_profile   = aws_iam_instance_profile.host.name
  monitoring             = true

  user_data = templatefile("${path.module}/bootstrap.sh.tftpl", {
    compose_version = "5.5.1"
    environment     = var.environment
    region          = var.region
    repository      = var.github_repository
    registry        = local.registry
    backup_bucket   = aws_s3_bucket.backups.bucket
    domain          = var.domain_name
    acme_email      = var.acme_email
  })

  metadata_options {
    http_tokens = "required" # IMDSv2 only
    # 2 hops: containers on Docker's bridge network reach the instance role's credentials (S3).
    http_put_response_hop_limit = 2
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = var.root_volume_gb
    encrypted   = true
  }

  tags = { Name = "feedants-${var.environment}" }

  lifecycle {
    # A newer AMI or bootstrap must not replace the host (and its data) on the next apply;
    # replacing the host is a deliberate rebuild + restore (docs/05-operations/runbooks/restore.md).
    ignore_changes = [ami, user_data]
  }
}

resource "aws_eip" "host" {
  instance = aws_instance.host.id
  domain   = "vpc"
  tags     = { Name = "feedants-${var.environment}" }
}

resource "aws_route53_record" "api" {
  count   = var.route53_zone_id == "" ? 0 : 1
  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "A"
  ttl     = 300
  records = [aws_eip.host.public_ip]
}
