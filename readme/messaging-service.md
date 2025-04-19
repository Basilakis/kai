# Messaging Service

The Messaging Service provides a centralized system for sending notifications through various channels including email, SMS, and webhooks. It supports template-based message generation and user notification preferences.

## Features

- **Multi-Channel Notifications**: Send notifications through email, SMS, webhooks, and in-app channels
- **Template System**: Use Handlebars templates for consistent message formatting
- **User Preferences**: Respect user notification preferences
- **Event-Based Notifications**: Trigger notifications based on system events
- **Webhook Integration**: Allow external systems to receive notifications via webhooks
- **Delivery Tracking**: Log and track notification delivery status

## Architecture

The Messaging Service is built with a modular architecture:

```
Messaging Service
├── Core Service (notificationService)
├── Providers
│   ├── Email Provider
│   ├── SMS Provider
│   └── Webhook Provider
├── Templates
│   └── Template Service
└── Event System
    └── Event Notification Service
```

## Usage Examples

### Sending an Email

```typescript
import { notificationService } from '../services/messaging/notificationService';

// Send a simple email
await notificationService.sendEmail({
  to: 'user@example.com',
  subject: 'Welcome to KAI',
  text: 'Thank you for joining our platform!',
  html: '<p>Thank you for joining our platform!</p>'
});

// Send an email with user tracking
await notificationService.sendEmail({
  to: 'user@example.com',
  subject: 'Welcome to KAI',
  text: 'Thank you for joining our platform!',
  html: '<p>Thank you for joining our platform!</p>',
  userId: 'user-123',
  eventType: 'user.registered'
});
```

### Sending an SMS

```typescript
import { notificationService } from '../services/messaging/notificationService';

// Send an SMS
await notificationService.sendSMS({
  to: '+1234567890',
  message: 'Your verification code is: 123456'
});
```

### Sending a Webhook Notification

```typescript
import { notificationService } from '../services/messaging/notificationService';

// Send a webhook notification
await notificationService.sendWebhook({
  url: 'https://example.com/webhook',
  payload: {
    event: 'order.created',
    data: {
      orderId: 'order-123',
      amount: 99.99
    }
  }
});
```

### Sending an In-App Notification

```typescript
import { notificationService } from '../services/messaging/notificationService';

// Send an in-app notification
await notificationService.sendInAppNotification({
  userId: 'user-123',
  title: 'New Message',
  message: 'You have a new message from Admin',
  type: 'info',
  actionUrl: '/messages/123'
});
```

### Using the Event-Based System

```typescript
import { eventNotificationService, EventType } from '../services/messaging/eventNotificationService';

// Trigger an event that will send notifications based on configured rules
await eventNotificationService.processEvent({
  eventType: EventType.SUBSCRIPTION_PAYMENT_FAILED,
  userId: 'user-123',
  data: {
    subscriptionId: 'sub-123',
    failureReason: 'insufficient_funds'
  }
});
```

## Configuration

The messaging service can be configured through environment variables:

### Email Configuration

```
EMAIL_SERVICE=smtp
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=username
EMAIL_PASSWORD=password
EMAIL_FROM=noreply@example.com
```

### SMS Configuration

```
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

### Webhook Configuration

```
WEBHOOK_TIMEOUT=5000
WEBHOOK_MAX_RETRIES=3
WEBHOOK_RETRY_DELAY=1000
```

## Database Schema

The messaging service uses the following database tables:

- `notification_logs`: Logs of all sent notifications
- `user_notification_preferences`: User preferences for notifications
- `notifications`: In-app notifications
- `message_templates`: Templates for notifications
- `notification_rules`: Rules for event-based notifications
- `webhook_configurations`: Webhook integration configurations
- `webhook_delivery_logs`: Logs of webhook deliveries
- `event_logs`: Logs of system events

## API Endpoints

### Notification Preferences

- `GET /api/notifications/preferences`: Get notification preferences
- `PUT /api/notifications/preferences`: Update notification preferences

### In-App Notifications

- `GET /api/notifications`: Get in-app notifications
- `POST /api/notifications/mark-as-read`: Mark notifications as read
- `POST /api/notifications/mark-all-as-read`: Mark all notifications as read
- `POST /api/notifications/delete`: Delete notifications
- `GET /api/notifications/unread-count`: Get unread notification count
- `POST /api/notifications/test`: Send a test notification

### Webhook Management

- `GET /api/webhooks/configurations`: Get webhook configurations
- `GET /api/webhooks/configurations/:id`: Get a webhook configuration
- `POST /api/webhooks/configurations`: Create a webhook configuration
- `PUT /api/webhooks/configurations/:id`: Update a webhook configuration
- `DELETE /api/webhooks/configurations/:id`: Delete a webhook configuration
- `GET /api/webhooks/configurations/:id/logs`: Get webhook delivery logs
- `POST /api/webhooks/configurations/:id/test`: Test a webhook configuration
- `POST /api/webhooks/configurations/:id/regenerate-secret`: Regenerate webhook secret

## Security Considerations

- All sensitive data (API keys, passwords) is stored in environment variables
- Webhook payloads are signed with a secret for verification
- Rate limiting is applied to notification endpoints
- Authentication is required for all notification management endpoints
- User notification preferences are protected by row-level security

## Future Enhancements

- Push notification support
- Message scheduling and batching
- A/B testing for notification content
- Advanced analytics for notification engagement
- Support for more notification channels (e.g., Slack, Microsoft Teams)
