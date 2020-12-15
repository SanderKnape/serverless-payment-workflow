import { LambdaProxyIntegration } from '@aws-cdk/aws-apigatewayv2-integrations';
import { ARecord, HostedZone, RecordTarget } from '@aws-cdk/aws-route53';
import { ApiGatewayv2Domain } from '@aws-cdk/aws-route53-targets';
import { DnsValidatedCertificate } from '@aws-cdk/aws-certificatemanager';
import { DomainName, HttpApi, HttpMethod } from '@aws-cdk/aws-apigatewayv2';
import { AttributeType, Table } from '@aws-cdk/aws-dynamodb';
import { Bucket } from '@aws-cdk/aws-s3';
import { BucketDeployment, Source } from '@aws-cdk/aws-s3-deployment';
import { Code, Function, Runtime } from '@aws-cdk/aws-lambda';
import { App, CfnOutput, Stack, StackProps } from '@aws-cdk/core';

const mollieApiKey = '[mollie_api_key]';

const domain = '[domain]';
const paymentsDomain = `payments.${domain}`;

export class PaymentsStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    // the basic stuff: DynamoDB, S3, Lambda
    const table = new Table(this, 'PaymentsTable', {
      partitionKey: {name: 'id', type: AttributeType.STRING },
      readCapacity: 1,
      writeCapacity: 1,
    });

    const website = new Bucket(this, 'WebsiteBucket', {
      websiteIndexDocument: 'index.html',
      publicReadAccess: true,
    });

    new CfnOutput(this, 'WebsiteUrl', {
      value: website.bucketWebsiteUrl,
    });

    new BucketDeployment(this, 'Website', {
      sources: [Source.asset('./src/website')],
      destinationBucket: website,
    });

    const createFunction = new Function(this, 'CreateFunction', {
      runtime: Runtime.NODEJS_12_X,
      handler: 'create.handler',
      code: Code.fromAsset('./src/functions'),
      environment: {
        MOLLIE_API_KEY: mollieApiKey,
        API_ENDPOINT: paymentsDomain,
        WEBSITE_URL: website.bucketWebsiteUrl,
        PAYMENTS_TABLE_NAME: table.tableName,
      },
    });

    const updateFunction = new Function(this, 'UpdateFunction', {
      runtime: Runtime.NODEJS_12_X,
      handler: 'update.handler',
      code: Code.fromAsset('./src/functions'),
      environment: {
        MOLLIE_API_KEY: mollieApiKey,
        PAYMENTS_TABLE_NAME: table.tableName,
      },
    });

    const getFunction = new Function(this, 'GetFunction', {
      runtime: Runtime.NODEJS_12_X,
      handler: 'get.handler',
      code: Code.fromAsset('./src/functions'),
      environment: {
        PAYMENTS_TABLE_NAME: table.tableName,
      },
    });

    table.grantReadWriteData(createFunction);
    table.grantReadWriteData(updateFunction);
    table.grantReadData(getFunction);

    // the configuration for the API domain
    const domainHostedZone = HostedZone.fromLookup(this, 'Zone', {
      domainName: domain,
    });

    const certificate = new DnsValidatedCertificate(this, 'WebsiteCertificate', {
      domainName: paymentsDomain,
      hostedZone: domainHostedZone,
    });

    const apiDomainName = new DomainName(this, 'Domainname', {
      domainName: paymentsDomain,
      certificate: certificate,
    });

    new ARecord(this, 'CustomDomainRecord', {
      zone: domainHostedZone,
      recordName: 'payments',
      target: RecordTarget.fromAlias(new ApiGatewayv2Domain(apiDomainName)),
    });

    // the actual API configuration
    const api = new HttpApi(this, 'Payments', {
      defaultDomainMapping: {
        domainName: apiDomainName,
      },
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [HttpMethod.GET],
      },
    });

    api.addRoutes({
      path: '/',
      methods: [ HttpMethod.POST ],
      integration: new LambdaProxyIntegration({
        handler: createFunction,
      }),
    });

    api.addRoutes({
      path: '/{id}',
      methods: [ HttpMethod.POST ],
      integration: new LambdaProxyIntegration({
        handler: updateFunction,
      }),
    });

    api.addRoutes({
      path: '/{id}',
      methods: [ HttpMethod.GET ],
      integration: new LambdaProxyIntegration({
        handler: getFunction,
      }),
    });
  }
}
