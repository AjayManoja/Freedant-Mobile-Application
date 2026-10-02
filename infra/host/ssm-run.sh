#!/usr/bin/env bash
# Runs a shell command on the host through SSM Run Command, waits for it, prints its output and
# exits with its status. Used by the deploy workflow; works from a laptop with the same role.
#
#   ssm-run.sh <instance-id> "<command>"
set -euo pipefail

instance=${1:?usage: ssm-run.sh <instance-id> <command>}
command=${2:?usage: ssm-run.sh <instance-id> <command>}

params=$(jq -nc --arg c "$command" '{commands: [$c], executionTimeout: ["1500"]}')
id=$(aws ssm send-command --instance-ids "$instance" --document-name AWS-RunShellScript \
  --comment "feedants: ${command:0:90}" --parameters "$params" --timeout-seconds 60 \
  --query Command.CommandId --output text)
echo "SSM command $id on $instance"

status=Pending
while [[ $status =~ ^(Pending|InProgress|Delayed)$ ]]; do
  sleep 10
  status=$(aws ssm get-command-invocation --command-id "$id" --instance-id "$instance" \
    --query Status --output text 2>/dev/null || echo Pending)
done

# SSM keeps the last 24 000 characters of each stream, plenty for one deploy log.
aws ssm get-command-invocation --command-id "$id" --instance-id "$instance" \
  --query '[StandardOutputContent, StandardErrorContent]' --output text
echo "Status: $status"
[[ $status == Success ]]
