# Notification System

The notification system provides a unified interface for sending notifications to users through various channels, including email, SMS, push notifications, and in-app notifications. It also supports webhooks for integrating with external systems.

## Features

- **Multi-channel notifications**: Send notifications through email, SMS, push notifications, and in-app channels
- **Push notifications with Supabase**: Integrated with Supabase for push notification delivery
- **User-specific webhooks**: Allow users to configure webhooks for receiving notifications in their own systems
- **Notification templates**: Create and manage reusable notification templates
- **Notification preferences**: Users can configure their notification preferences
- **Scheduled notifications**: Schedule notifications to be sent at a specific time
- **Credit system integration**: Track notification usage with the credit system
- **MCP middleware integration**: Send notifications through the MCP middleware

## Architecture

The notification system consists of the following components:

1. **Notification Service**: Core service for sending notifications through various channels
2. **Notification Providers**: Channel-specific providers for email, SMS, push, and webhooks
3. **Notification Templates**: Reusable templates for notifications
4. **Notification Preferences**: User-specific notification preferences
5. **Notification API**: REST API for managing notifications
6. **Webhook System**: System for sending and receiving webhooks
7. **Supabase Edge Functions**: Serverless functions for push notifications

## Database Schema

The notification system uses the following database tables:

- `notifications`: Stores in-app notifications
- `notification_preferences`: Stores user notification preferences
- `notification_templates`: Stores notification templates
- `scheduled_notifications`: Stores scheduled notifications
- `notification_logs`: Stores notification delivery logs
- `webhook_configurations`: Stores webhook configurations
- `webhook_delivery_logs`: Stores webhook delivery logs
- `push_notifications`: Stores push notifications
- `device_tokens`: Stores device tokens for push notifications

## Push Notifications with Supabase

Push notifications are implemented using Supabase Edge Functions and Expo's push notification service. The system works as follows:

1. User registers a device token through the client application
2. The token is stored in the `device_tokens` table or in the `expo_push_token` field of the `profiles` table
3. When a push notification needs to be sent, the system calls the Supabase Edge Function
4. The Edge Function sends the notification to Expo's push notification service
5. Expo delivers the notification to the user's device

### Setting Up Push Notifications

1. Deploy the Supabase Edge Function:

```bash
cd packages/server/supabase/functions
supabase functions deploy push --project-ref your-project-ref
```

2. Set the required environment variables:

```bash
supabase secrets set EXPO_ACCESS_TOKEN=your-expo-access-token --project-ref your-project-ref
```

3. Update the webhook trigger in the database migration:

```sql
-- Update the URL in the handle_new_push_notification function
PERFORM http_post(
  url := 'https://YOUR_PROJECT_REF.functions.supabase.co/push',
  ...
);
```

## Webhooks

The webhook system allows users to configure webhooks to receive notifications about events in their account. The system works as follows:

1. User creates a webhook configuration through the client application
2. When an event occurs, the system checks if any webhooks are configured for that event
3. If webhooks are found, the system sends HTTP requests to the configured URLs
4. The system logs the delivery status and response

### Webhook Security

Webhooks are secured using the following mechanisms:

1. **Secret Key**: Each webhook has a secret key that is used to sign the payload
2. **Signature Header**: The system includes an `X-Webhook-Signature` header with each request
3. **HMAC Verification**: The recipient can verify the signature using the secret key

### Webhook Payload

Webhook payloads have the following structure:

```json
{
  "event": "event.type",
  "timestamp": "2023-05-25T12:34:56Z",
  "data": {
    // Event-specific data
  }
}
```

## API Endpoints

The notification system provides the following API endpoints:

### Notification Preferences

- `GET /api/notifications/preferences`: Get notification preferences
- `PUT /api/notifications/preferences`: Update notification preferences

### Notifications

- `GET /api/notifications/history`: Get notification history
- `POST /api/notifications/mark-as-read`: Mark notifications as read
- `POST /api/notifications/mark-all-as-read`: Mark all notifications as read
- `POST /api/notifications/delete`: Delete notifications
- `POST /api/notifications/test`: Send a test notification

### Webhook Configurations

- `GET /api/webhooks/configurations`: Get webhook configurations
- `GET /api/webhooks/configurations/:id`: Get webhook configuration by ID
- `POST /api/webhooks/configurations`: Create webhook configuration
- `PUT /api/webhooks/configurations/:id`: Update webhook configuration
- `DELETE /api/webhooks/configurations/:id`: Delete webhook configuration
- `POST /api/webhooks/configurations/:id/test`: Test webhook
- `POST /api/webhooks/configurations/:id/regenerate-secret`: Regenerate webhook secret
- `GET /api/webhooks/configurations/:id/logs`: Get webhook delivery logs

### Admin Endpoints

- `POST /api/notifications/send`: Send notification to users
- `GET /api/notifications/templates`: Get notification templates
- `GET /api/notifications/templates/:id`: Get notification template by ID
- `POST /api/notifications/templates`: Create notification template
- `PUT /api/notifications/templates/:id`: Update notification template
- `DELETE /api/notifications/templates/:id`: Delete notification template
- `GET /api/notifications/stats`: Get notification stats
- `GET /api/webhooks/admin/configurations`: Get all webhook configurations
- `GET /api/webhooks/admin/logs`: Get all webhook delivery logs
- `GET /api/webhooks/admin/stats`: Get webhook stats

## Usage Examples

### Sending a Notification

```typescript
import { notificationService, NotificationType } from '../../services/messaging/notificationService';

// Send an email notification
const emailResult = await notificationService.sendEmail({
  to: 'user@example.com',
  subject: 'Welcome to our platform',
  text: 'Thank you for joining our platform!',
  html: '<h1>Welcome!</h1><p>Thank you for joining our platform!</p>',
  userId: 'user-id'
});

// Send an SMS notification
const smsResult = await notificationService.sendSMS({
  to: '+1234567890',
  message: 'Your verification code is 123456',
  userId: 'user-id'
});

// Send a push notification
const pushResult = await notificationService.sendPushNotification({
  to: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  title: 'New message',
  body: 'You have a new message',
  userId: 'user-id'
});

// Send an in-app notification
const inAppResult = await notificationService.sendInAppNotification({
  userId: 'user-id',
  title: 'New feature available',
  message: 'Check out our new feature!',
  type: 'info'
});
```

### Sending a Webhook

```typescript
import { webhookService } from '../../services/messaging/webhookService';

// Send a webhook
const webhookResult = await webhookService.sendWebhook({
  url: 'https://example.com/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Custom-Header': 'custom-value'
  },
  payload: {
    event: 'user.created',
    timestamp: new Date().toISOString(),
    data: {
      userId: 'user-id',
      email: 'user@example.com'
    }
  },
  userId: 'user-id',
  webhookId: 'webhook-id',
  eventType: 'user.created'
});
```

## Integration with MCP Middleware

The notification system can be integrated with the MCP middleware to send notifications through the MCP server. This integration works as follows:

1. The notification service checks if the MCP server is available
2. If available, it checks if the user has enough credits for the notification
3. If both conditions are met, the notification is sent through the MCP server
4. Otherwise, the notification is sent directly through the appropriate provider

To enable MCP integration, set the following environment variables:

```
MCP_SERVER_URL=http://localhost:8000
MCP_ENABLED=true
```

## Credit System Integration

The notification system is integrated with the credit system to track notification usage. Each notification channel has a corresponding credit service key:

- `MCPServiceKey.EMAIL_NOTIFICATION`: Email notifications
- `MCPServiceKey.SMS_NOTIFICATION`: SMS notifications
- `MCPServiceKey.PUSH_NOTIFICATION`: Push notifications
- `MCPServiceKey.WEBHOOK_NOTIFICATION`: Webhook notifications

The credit usage is tracked when notifications are sent through the MCP middleware.
