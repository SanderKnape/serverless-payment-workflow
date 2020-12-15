const DynamoDB = require('aws-sdk/clients/dynamodb');
const dynamodb = new DynamoDB();

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    const paymentId = event.pathParameters.id;

    const item = await dynamodb.getItem({
        TableName: process.env.PAYMENTS_TABLE_NAME,
        Key: {
            'id': {'S': paymentId},
        },
    }).promise();

    response = {
        'statusCode': 200,
        'body': JSON.stringify(item),
    };

    return response;
};
