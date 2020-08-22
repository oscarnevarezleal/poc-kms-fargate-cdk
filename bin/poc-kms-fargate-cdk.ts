#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { PocKmsFargateCdkStack } from '../lib/poc-kms-fargate-cdk-stack';

const app = new cdk.App();
new PocKmsFargateCdkStack(app, 'PocKmsFargateCdkStack');
