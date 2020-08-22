#!/bin/bash

env

INSTANCE_NAME=poc-kms-fargate-instance
#$(aws configure get region)
aws configure set region "${AWS_DEFAULT_REGION:=us-east-1}"

################################################################################
# The section below obtains an activation code and ID from SSM, and then uses it
# to register the current agent. _This should only be done on the basis of
# tightly controlled roles granted to ECS._ Note that it is registered with two
# tags:
#
#     Name:    While the name is set via --default-instance-name, the name will
#              only show up when queries are performed in the CLI. The "Name"
#              tag is required for the name to be visible in the AWS console.
#     Type:    This acts a flag, so that only offline Fargate instances get
#              cleaned up.
#
# The SSM agent is then started. Output is redirected to STDOUT and the process
# is sent to the background. Both of these actions are require to prevent the
# agent from blocking the script.
################################################################################
read -r ACTIVATION_CODE ACTIVATION_ID <<< $(aws ssm create-activation --default-instance-name "${INSTANCE_NAME}" --iam-role "${ssmRole}" --registration-limit 1 --tags "Key=Name,Value=${INSTANCE_NAME}" "Key=Type,Value=fargate" --query "join(' ', [ActivationCode, ActivationId])" --output text)
echo "[ $ACTIVATION_CODE, $ACTIVATION_ID $? ]"
if test $? -ne 0; then \
  echo "FAILED $?"
  exit 255
fi

amazon-ssm-agent -register -code "${ACTIVATION_CODE}" -id "${ACTIVATION_ID}" -region "${AWS_DEFAULT_REGION}" -clear -y

# Agent can be spawned by supervisord
amazon-ssm-agent

# Manage the logs by redirecting output to CloudWatch log groups...
