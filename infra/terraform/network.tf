# One public subnet: the host needs outbound internet (GHCR, GitHub, Let's Encrypt, SMTP,
# Razorpay) and inbound 80/443 only. No NAT gateway, no SSH (NFR-SC-01): operators use
# SSM Session Manager.

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "main" {
  cidr_block           = "10.20.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "feedants-${var.environment}" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "feedants-${var.environment}" }
}

resource "aws_subnet" "public" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.20.1.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]
  tags              = { Name = "feedants-${var.environment}-public" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "feedants-${var.environment}-public" }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# The VPC's default security group is left with no rules, so nothing uses it by accident.
resource "aws_default_security_group" "default" {
  vpc_id = aws_vpc.main.id
}

resource "aws_security_group" "host" {
  name        = "feedants-${var.environment}-host"
  description = "Gateway only: HTTP (ACME challenge, redirect) and HTTPS"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "http" {
  security_group_id = aws_security_group.host.id
  description       = "HTTP: Let's Encrypt challenge and redirect to HTTPS"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

resource "aws_vpc_security_group_ingress_rule" "https" {
  security_group_id = aws_security_group.host.id
  description       = "HTTPS: the API gateway"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

# Outbound HTTPS: GHCR and Docker Hub images, GitHub release files, SSM, S3, Let's Encrypt,
# the payment provider. DNS and NTP use the VPC's link-local resolvers, which SGs don't filter.
#trivy:ignore:AWS-0104 Destinations are public SaaS endpoints with no fixed address ranges.
resource "aws_vpc_security_group_egress_rule" "https" {
  security_group_id = aws_security_group.host.id
  description       = "HTTPS to images, release files, AWS APIs, ACME, payment provider"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

# Outbound mail submission (OTP codes, alerts) to the SMTP provider.
#trivy:ignore:AWS-0104 The SMTP provider's addresses are not fixed.
resource "aws_vpc_security_group_egress_rule" "smtp" {
  for_each          = toset(["465", "587"])
  security_group_id = aws_security_group.host.id
  description       = "SMTP submission (port ${each.value})"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = tonumber(each.value)
  to_port           = tonumber(each.value)
}
