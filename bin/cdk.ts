#!/usr/bin/env node
import { App } from '@aws-cdk/core';
import { PaymentsStack } from '../lib/payments-stack';

const app = new App();
new PaymentsStack(app, 'PaymentsStack', {
    env: {
        account: '[account_id]',
        region: '[region]',
    }
});
