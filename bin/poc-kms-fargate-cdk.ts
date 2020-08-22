#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import {PocKmsFargateCdkStack} from '../lib/poc-kms-fargate-cdk-stack';

export const CDK_DEFAULT_ACCOUNT = process.env.CDK_DEFAULT_ACCOUNT;
export const CDK_DEFAULT_REGION = process.env.CDK_DEFAULT_REGION;

const app = new cdk.App();
new PocKmsFargateCdkStack(app, 'PocKmsFargateCdkStack', {
    env: {
        account: CDK_DEFAULT_ACCOUNT,
        region: CDK_DEFAULT_REGION,
    }
});
