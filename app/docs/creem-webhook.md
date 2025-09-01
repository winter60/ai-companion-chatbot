# Introduction

> Use webhooks to notify your application about payment events."


## What is a webhook?

Creem uses webhooks to push real-time notifications to you about your payments and subscriptions. All webhooks use HTTPS and deliver a JSON payload that can be used by your application. You can use webhook feeds to do things like:

* Automatically enable access to a user after a successful payment
* Automatically remove access to a user after a canceled subscription
* Confirm that a payment has been received by the same customer that initiated it.

In case webhooks are not successfully received by your endpoint, creem automatically retries to send the request with a progressive backoff period of 30 seconds, 1 minute, 5 minutes and 1 hour.

## Steps to receive a webhook

You can start receiving real-time events in your app using the steps:

* Create a local endpoint to receive requests
* Register your development webhook endpoint on the Developers tab of the Creem dashboard
* Test that your webhook endpoint is working properly using the test environment
* Deploy your webhook endpoint to production
* Register your production webhook endpoint on Creem live dashboard

### 1. Create a local endpoint to receive requests

In your local application, create a new route that can accept POST requests.

For example, you can add an API route on Next.js:

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';

export default (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === 'POST') {
    const payload = req.body;
    console.log(payload);
    res.status(200);
  }
};
```

On receiving an event, you should respond with an HTTP 200 OK to signal to Creem that the event was successfully delivered.

### 2. Register your development webhook endpoint

Register your publicly accessible HTTPS URL in the Creem dashboard.

<Tip>
  You can create a tunnel to your localhost server using a tool like ngrok. For example: [https://8733-191-204-177-89.sa.ngrok.io/api/webhooks](https://8733-191-204-177-89.sa.ngrok.io/api/webhooks)
</Tip>

<img style={{ borderRadius: '0.5rem' }} src="https://nucn5fajkcc6sgrd.public.blob.vercel-storage.com/test-webhook-yBodvIWasxCmgr4bYqZJBlWg8qbUD2.png" />

### 3. Test that your webhook endpoint is working properly

Create a few test payments to check that your webhook endpoint is receiving the events.

### 4. Deploy your webhook endpoint

After you’re done testing, deploy your webhook endpoint to production.

### 5. Register your production webhook endpoint

Once your webhook endpoint is deployed to production, you can register it in the Creem dashboard.
