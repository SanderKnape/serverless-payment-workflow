const uuid = require('uuid');
const { createMollieClient } = require('@mollie/api-client');
const DynamoDB = require('aws-sdk/clients/dynamodb');

const mollieClient = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY });
const dynamodb = new DynamoDB();

// "database" of articles
const articles = {
    1: {
        name: 'My Best Article',
        price: '50.00',
    },
    2: {
        name: 'My Not So Great Article',
        price: '10.00',
    },
    3: {
        name: 'A Penguin',
        price: '200.00',
    }
};

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    // grab the articleId from the string "article=X"
    const articleId = event['body'].replace(/(\r\n|\n|\r)/g, '').split('=')[1];

    // fetch the article information from our "database"
    const article = articles[articleId];

    let response;

    try {
        const paymentId = uuid.v4();

        const molliePayment = await mollieClient.payments.create({
            amount: {
                value: article.price,
                currency: 'EUR',
            },
            method: 'creditcard',
            description: article.name,
            redirectUrl: `${process.env.WEBSITE_URL}/payment.html?id=${paymentId}`,
            webhookUrl: `https://${process.env.API_ENDPOINT}/${paymentId}`,
        });

        await dynamodb.putItem({
            TableName: process.env.PAYMENTS_TABLE_NAME,
            Item: {
                'id': {'S': paymentId},
                'molliePaymentId': {'S': molliePayment.id},
                'paymentStatus': {'S': 'pending'},
            },
        }).promise();

        response = {
            'statusCode': 301,
            'headers': {
                'Location': molliePayment._links.checkout.href,
            },
        };
    } catch(error) {
        response = {
            'statusCode': 500
        };
    };

    return response;
};
