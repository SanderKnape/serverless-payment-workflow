const { createMollieClient } = require('@mollie/api-client');
const DynamoDB = require('aws-sdk/clients/dynamodb');

const mollieClient = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY });
const dynamodb = new DynamoDB();

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    // the payload is base64 encoded
    const payload = Buffer.from(event['body'], 'base64').toString('utf-8');

    // grab the molliePaymentId from the string "id=X"
    const molliePaymentId = payload.split('=')[1];

    const paymentId = event.pathParameters.id;

    let response;

    try {
        const payment = await mollieClient.payments.get(molliePaymentId);

        await dynamodb.updateItem({
            TableName: process.env.PAYMENTS_TABLE_NAME,
            Key: {
                'id': {'S': paymentId},
            },
            UpdateExpression: 'set paymentStatus = :s',
            ExpressionAttributeValues: {
                ':s': {'S': payment.status },
            },
        }).promise();

        response = {
            'statusCode': 200,
        };
    } catch(error) {
        console.log(error);
        response = {
            'statusCode': 500
        };
    };

    return response;
};
