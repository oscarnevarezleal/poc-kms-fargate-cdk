import * as cdk from "@aws-cdk/core";
import * as iam from "@aws-cdk/aws-iam";
import * as ecs from "@aws-cdk/aws-ecs";
import * as ec2 from "@aws-cdk/aws-ec2";
import {DockerImageAsset} from "@aws-cdk/aws-ecr-assets";
import * as path from "path";
import ecs_patterns = require('@aws-cdk/aws-ecs-patterns');

export class PocKmsFargateCdkStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {

        super(scope, id, props);

        // The code that defines your stack goes here

        // @ts-ignore
        const vpc = ec2.Vpc.fromLookup(this, "DefaultVpc", {isDefault: true});
        // @ts-ignore
        const cluster = new ecs.Cluster(this, "DefaultEcsCluster", {
            vpc: vpc,
            containerInsights: true,
        });

        const asset = new DockerImageAsset(this, "poc-kms-fargate-cdk-image", {
            directory: path.join(
                __dirname,
                ".",
                "image"
            ),
        });

        // @ts-ignore
        const taskDefinition = new ecs.FargateTaskDefinition(this, "TaskDefinition", {
            memoryLimitMiB: 1024,
            cpu: 512,
        });

        const containerDefinition = taskDefinition.addContainer("FargateContainer", {
            image: ecs.ContainerImage.fromEcrRepository(
                asset.repository,
                asset.imageUri.split(":").pop()
            ),
            memoryLimitMiB: 256,
            logging: new ecs.AwsLogDriver({
                streamPrefix: "poc-kms-fargate-cdk",
            }),
        });

        taskDefinition.addToExecutionRolePolicy(
            new iam.PolicyStatement({
                actions: ['kms:*', "ecr:*", "ecs:*", "cloudformation:*", "iam:*"],
                effect: iam.Effect.ALLOW,
                resources: ["*"],
            })
        );

        const taskRole = new iam.Role(this, 'FargateServiceTaskRole', {
            roleName: 'taskRole',
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
            inlinePolicies: {
                taskRolePolicy0: new iam.PolicyDocument({
                    statements: [new iam.PolicyStatement({
                        actions: [
                            "iam:PassRole",
                            "ssm:CreateActivation",
                            "ssm:UpdateInstanceInformation",
                            "ssm:AddTagsToResource"], //"ecr:*", "kms:*", "iam:*"
                        effect: iam.Effect.ALLOW,
                        resources: ["*"],
                    })]
                })
            }
        });

        // https://docs.aws.amazon.com/systems-manager/latest/userguide/sysman-service-role.html
        const ssmRole = new iam.Role(this, 'SSMRole', {
            roleName: 'SSMRole',
            assumedBy: new iam.ServicePrincipal('ssm.amazonaws.com'),
            inlinePolicies: {
                hi: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            actions: [
                                'ec2messages:GetMessages',
                                'ec2messages:AcknowledgeMessage',
                                'ec2messages:SendReply'
                            ],
                            effect: iam.Effect.ALLOW,
                            resources: ["*"],
                        }),
                        new iam.PolicyStatement({
                            actions: [
                                'sts:AssumeRole'
                            ],
                            effect: iam.Effect.ALLOW,
                            resources: ["*"],
                        }),
                        new iam.PolicyStatement({
                            actions: [
                                'ssm:ListAssociations',
                                'ssm:UpdateInstanceInformation'
                            ],
                            effect: iam.Effect.ALLOW,
                            resources: ["*"],
                        })
                    ]
                })
            }
        })

        //https://docs.aws.amazon.com/systems-manager/latest/userguide/getting-started-add-permissions-to-existing-profile.html
        ssmRole.addToPolicy(new iam.PolicyStatement({
            actions: [
                "ssmmessages:CreateControlChannel",
                "ssmmessages:CreateDataChannel",
                "ssmmessages:OpenControlChannel",
                "ssmmessages:OpenDataChannel"
            ],
            resources: ["*"],
            effect: iam.Effect.ALLOW
        }));

        ssmRole.addToPolicy(new iam.PolicyStatement({
            actions: ["s3:GetEncryptionConfiguration"],
            resources: ["*"],
            effect: iam.Effect.ALLOW
        }));

        // ssmRole.addToPolicy(new iam.PolicyStatement({
        //     actions: ["kms:Decrypt"],
        //     resources: ["key-name"], // change to our key
        //     effect: iam.Effect.ALLOW
        // }));

        // Instantiate Fargate Service with a cluster and a local image that gets
        // uploaded to an S3 staging bucket prior to being uploaded to ECR.
        // A new repository is created in ECR and the Fargate service is created
        // with the image from ECR.
        // @ts-ignore
        new ecs_patterns.ApplicationLoadBalancedFargateService(this, "FargateService", {
            cluster,
            assignPublicIp: true,
            taskImageOptions: {
                taskRole,
                environment: {
                    ssmRole: ssmRole.roleName
                },
                image: ecs.ContainerImage.fromDockerImageAsset(asset)
            },
        });


    }
}

