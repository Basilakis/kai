# Notification and Webhook System

The Notification and Webhook System provides a comprehensive messaging framework for the KAI platform, enabling communication through multiple channels including in-app notifications, email, SMS, and webhook integrations with external systems.

## Overview

The system supports:

1. **Multi-Channel Notifications** - Send messages through in-app, email, SMS, and webhook channels
2. **Template-Based Messaging** - Configurable templates with Handlebars support
3. **User Preference Management** - Honor user notification preferences
4. **Event-Driven Architecture** - Trigger notifications based on system events
5. **Webhook Integration** - Allow external systems to receive notifications
6. **Delivery Tracking** - Monitor notification delivery status

This unified notification infrastructure enables consistent communication across the platform while respecting user preferences and providing robust integration options for external systems.

## Architecture

The system is built with a modular architecture:

```
Notification & Webhook System
├── Core Services
│   ├── Notification Service
│   ├── Template Service
│   ├── Preference Service
│   └── Event Notification Service
├── Delivery Providers
│   ├── Email Provider
│   ├── SMS Provider
│   ├── In-App Provider
│   └── Webhook Provider
├── Configuration
│   ├── Template Configuration
│   ├── Channel Configuration
│   └── User Preferences
└── Management Interfaces
    ├── User Preference UI
    ├── Admin Template Editor
    └── Admin Webhook Manager
```

## Key Components

### Notification Service

The core service responsible for routing and delivering messages through appropriate channels.

Features:
- Message formatting with templates
- Channel selection based on message type and user preferences
- Delivery tracking and retry mechanism
- Batching capabilities for bulk notifications

### Template Service

Manages notification templates with support for dynamic content.

Features:
- Handlebars-based template system
- Multi-language support
- Version control for templates
- Preview functionality for testing

### Webhook Service

Manages outgoing webhook notifications to external systems.

Features:
- Webhook registration and management
- Payload signing for security
- Delivery confirmation
- Retry mechanism with exponential backoff
- Detailed delivery logs

## API Reference

### Notification API

```typescript
// Send an email notification
await notificationService.sendEmail({
  to: 'user@example.com',
  subject: 'Welcome to KAI',
  text: 'Thank you for joining our platform!',
  html: '<p>Thank you for joining our platform!</p>',
  userId: 'user-123',  // Optional for tracking
  eventType: 'user.registered'  // Optional event type
});

// Send an SMS notification
await notificationService.sendSMS({
  to: '+1234567890',
  message: 'Your verification code is: 123456',
  userId: 'user-123',
  eventType: 'verification.code'
});

// Send an in-app notification
await notificationService.sendInAppNotification({
  userId: 'user-123',
  title: 'New Message',
  message: 'You have a new message from Admin',
  type: 'info',  // 'info', 'warning', 'error', 'success'
  actionUrl: '/messages/123'  // Optional deep link
});

// Process an event that may trigger notifications
await eventNotificationService.processEvent({
  eventType: EventType.SUBSCRIPTION_PAYMENT_FAILED,
  userId: 'user-123',
  data: {
    subscriptionId: 'sub-123',
    failureReason: 'insufficient_funds'
  }
});
```

### Webhook API

```typescript
// Send a webhook notification
await notificationService.sendWebhook({
  url: 'https://example.com/webhook',
  payload: {
    event: 'order.created',
    data: {
      orderId: 'order-123',
      amount: 99.99
    }
  },
  headers: {  // Optional custom headers
    'X-Custom-Header': 'custom-value'
  }
});

// Register a webhook configuration
const webhook = await webhookService.createWebhookConfiguration({
  name: 'Order Processing Webhook',
  url: 'https://example.com/webhook',
  events: ['order.created', 'order.updated', 'order.cancelled'],
  isActive: true,
  secretKey: 'generate_new'  // Generates a new secret key
});

// Test a webhook configuration
const testResult = await webhookService.testWebhookConfiguration(
  webhookId,
  {
    event: 'order.created',
    data: { test: true, timestamp: Date.now() }
  }
);
```

## REST API Endpoints

The system exposes the following RESTful API endpoints:

### Notification Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | Get user's in-app notifications |
| POST | `/api/notifications/mark-as-read` | Mark notifications as read |
| POST | `/api/notifications/mark-all-as-read` | Mark all notifications as read |
| DELETE | `/api/notifications/:id` | Delete a notification |
| GET | `/api/notifications/unread-count` | Get unread notification count |
| GET | `/api/notifications/preferences` | Get notification preferences |
| PUT | `/api/notifications/preferences` | Update notification preferences |
| POST | `/api/notifications/test` | Send a test notification |

### Webhook Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/webhooks/configurations` | Get webhook configurations |
| GET | `/api/webhooks/configurations/:id` | Get a webhook configuration |
| POST | `/api/webhooks/configurations` | Create a webhook configuration |
| PUT | `/api/webhooks/configurations/:id` | Update a webhook configuration |
| DELETE | `/api/webhooks/configurations/:id` | Delete a webhook configuration |
| GET | `/api/webhooks/configurations/:id/logs` | Get webhook delivery logs |
| POST | `/api/webhooks/configurations/:id/test` | Test a webhook configuration |
| POST | `/api/webhooks/configurations/:id/regenerate-secret` | Regenerate webhook secret |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/notifications/templates` | Get notification templates |
| GET | `/api/admin/notifications/templates/:id` | Get a notification template |
| POST | `/api/admin/notifications/templates` | Create a notification template |
| PUT | `/api/admin/notifications/templates/:id` | Update a notification template |
| DELETE | `/api/admin/notifications/templates/:id` | Delete a notification template |
| POST | `/api/admin/notifications/templates/:id/test` | Test a notification template |
| GET | `/api/admin/notifications/logs` | Get notification logs |
| GET | `/api/admin/webhooks/logs` | Get all webhook delivery logs |

## Database Schema

The notification system uses the following database tables:

### Notification Tables

```
notification_templates
├── id: UUID (PK)
├── name: String
├── description: String
├── type: Enum('email', 'sms', 'in_app', 'webhook')
├── subject: String (for email)
├── content_text: String (plain text version)
├── content_html: String (HTML version for email)
├── variables: JSONB (template variables)
├── created_at: Timestamp
├── updated_at: Timestamp
└── version: Integer

notifications
├── id: UUID (PK)
├── user_id: UUID (FK to users)
├── title: String
├── message: String
├── type: Enum('info', 'warning', 'error', 'success')
├── action_url: String (optional deep link)
├── read: Boolean
├── created_at: Timestamp
└── metadata: JSONB

notification_logs
├── id: UUID (PK)
├── user_id: UUID (FK to users)
├── template_id: UUID (FK to notification_templates)
├── channel: Enum('email', 'sms', 'in_app', 'webhook')
├── status: Enum('sent', 'delivered', 'failed')
├── error: String (if failed)
├── metadata: JSONB
└── created_at: Timestamp

user_notification_preferences
├── user_id: UUID (PK, FK to users)
├── email_enabled: Boolean
├── sms_enabled: Boolean
├── in_app_enabled: Boolean
├── push_enabled: Boolean
├── preferences: JSONB (specific preferences by notification type)
└── updated_at: Timestamp
```

### Webhook Tables

```
webhook_configurations
├── id: UUID (PK)
├── name: String
├── url: String
├── events: String[] (array of event types)
├── is_active: Boolean
├── secret_key: String
├── headers: JSONB (custom headers)
├── created_at: Timestamp
├── updated_at: Timestamp
└── metadata: JSONB

webhook_delivery_logs
├── id: UUID (PK)
├── webhook_id: UUID (FK to webhook_configurations)
├── event_type: String
├── payload: JSONB
├── status_code: Integer
├── response: String
├── success: Boolean
├── attempt_count: Integer
├── error: String (if failed)
├── timestamp: Timestamp
└── duration_ms: Integer
```

## Notification Templates

The system supports the following notification template types:

### Email Templates

Email templates include both HTML and plain text versions with the following features:
- Responsive email design using MJML
- Support for deep links
- Tracking pixel support (optional)
- Unsubscribe links
- Localization support

Example email template:

```handlebars
{% raw %}
Subject: {{subject}}

<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text>
          Hello {{user.firstName}},

          {{message}}

          {{#if actionUrl}}
          <mj-button href="{{actionUrl}}">{{actionLabel}}</mj-button>
          {{/if}}
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
{% endraw %}
```

### SMS Templates

SMS templates support:
- Short text messages
- Variable substitution
- Link shortening
- Character count optimization

Example SMS template:

```handlebars
{% raw %}
{{message}} {{#if code}}Your code: {{code}}{{/if}} {{#if url}}Details: {{url}}{{/if}}
{% endraw %}
```

### In-App Templates

In-app notification templates support:
- Different notification types (info, warning, error, success)
- Action buttons and deep links
- Grouping and prioritization
- Expiration settings

Example in-app template:

```handlebars
{% raw %}
{
  "title": "{{title}}",
  "message": "{{message}}",
  "type": "{{type}}",
  "actionUrl": "{{actionUrl}}",
  "actionLabel": "{{actionLabel}}",
  "expireAfter": "{{expireAfter}}"
}
{% endraw %}
```

### Webhook Templates

Webhook notification templates support:
- Customizable JSON payloads
- Signature generation for security
- Metadata inclusion

Example webhook template:

```handlebars
{% raw %}
{
  "event": "{{event}}",
  "timestamp": "{{timestamp}}",
  "data": {{toJson data}},
  "metadata": {
    "platform": "KAI",
    "version": "{{version}}"
  }
}
{% endraw %}
```

## Webhook Integration

The webhook system provides robust integration with external systems:

### Security

Webhooks are secured using these methods:
- HMAC-SHA256 payload signing
- Secret key management
- HTTPS endpoints only
- Rate limiting

### Payload Format

Standard webhook payload format:

```json
{
  "event": "order.created",
  "timestamp": "2025-04-19T10:30:00Z",
  "data": {
    "orderId": "order-123",
    "customerId": "cust-456",
    "amount": 99.99,
    "items": [...]
  },
  "metadata": {
    "platform": "KAI",
    "version": "1.0"
  }
}
```

### Delivery

The webhook delivery system ensures reliable notification:
- Automatic retries with exponential backoff
- Configurable retry count and intervals
- Detailed delivery logs
- Success/failure tracking

### Registration

External systems can register webhooks through:
- Admin interface
- API endpoints
- Programmatic creation

## User Preference Management

The system respects user notification preferences with:

### Preference Levels

- **Global Preferences**: Master switches for each channel
- **Category Preferences**: Settings for notification categories
- **Individual Preferences**: Fine-grained control for specific notification types

### User Interface

The user preference interface allows:
- Channel enabling/disabling
- Time-based restrictions (quiet hours)
- Frequency controls
- Priority settings

### Enforcement

Preferences are enforced at multiple levels:
- During event processing
- At notification generation
- Before channel delivery

## Event-Based Notification System

The system uses an event-driven architecture:

### Event Types

Common event types include:
- `user.registered` - New user registration
- `order.created` - New order placed
- `subscription.renewed` - Subscription renewal
- `subscription.payment_failed` - Payment failure
- `material.recognized` - Successful material recognition

### Event Processing

Events flow through the system:
1. Event is triggered by an action in the system
2. Event is processed by the event notification service
3. Notification rules are evaluated against the event
4. Appropriate notifications are generated based on rules and preferences
5. Notifications are delivered through selected channels

### Rule Configuration

Rules determine when and how notifications are sent:
- Condition-based triggers
- Dynamic template selection
- Channel routing logic
- User targeting

## Integration with Other Systems

The notification system integrates with:

### Authentication System

- User identity management
- Permission checks for notification access
- Session tracking for delivery

### Subscription System

- Notification triggers based on subscription events
- Tier-based notification features
- Delivery channel access based on subscription level

### Analytics System

- Notification engagement tracking
- Delivery performance monitoring
- A/B testing of notification content

## Administration Interface

The admin interface allows management of:

### Template Management

- Create, edit and version templates
- Test templates with sample data
- View usage statistics

### Webhook Configuration

- Register and manage webhook endpoints
- Monitor delivery status
- Test webhook delivery

### Notification Logs

- View delivery status for all notifications
- Filter by user, template, channel, and status
- Export logs for analysis

## Configuration

The system can be configured through environment variables:

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

## Implementation Details

### Email Provider

The system supports multiple email providers:
- SMTP servers
- SendGrid
- Mailgun
- AWS SES

### SMS Provider

SMS delivery is supported through:
- Twilio
- Nexmo
- AWS SNS

### In-App Notifications

In-app notifications are delivered via:
- WebSocket for real-time updates
- Polling API for fallback
- Local storage for offline access

### Webhook Delivery

Webhook notifications are delivered using:
- HTTP/HTTPS POST requests
- Configurable timeout settings
- Automatic retry logic

## Performance Considerations

The notification system is designed for high throughput with:

### Scalability

- Queue-based processing for asynchronous delivery
- Horizontal scaling support
- Database sharding for high-volume deployments

### Reliability

- Delivery confirmation and tracking
- Retry mechanisms for failed deliveries
- Fallback channels when primary channels fail

### Efficiency

- Batch processing for high-volume notifications
- Template caching
- Database query optimization

## Security Features

The notification system implements several security features:

### Authentication

- Secure API endpoints
- User verification for preferences
- Admin authentication for template management

### Privacy

- PII handling according to regulations
- Obfuscation in logs
- Data minimization in payloads

### Data Protection

- Encryption of sensitive template data
- Secure storage of API keys
- Audit logging for all operations

## Future Enhancements

Planned enhancements include:

1. **Push Notification Support**: Native mobile push notifications
2. **Message Scheduling**: Time-based delivery options
3. **A/B Testing**: Test different message formats for engagement
4. **Advanced Analytics**: Detailed metrics on notification performance
5. **AI-Generated Content**: Smart template population based on context

## Best Practices

### Notification Design

- Keep messages concise and clear
- Use consistent formatting across channels
- Include actionable information
- Respect user attention

### Webhook Implementation

- Implement idempotent processing
- Use appropriate HTTP status codes
- Handle retries gracefully
- Verify webhook signatures

### Template Management

- Use version control for templates
- Test templates before deployment
- Include fallback content for each template
- Document variables used in templates

## Troubleshooting

Common issues and solutions:

### Notification Delivery Issues

- Check user notification preferences
- Verify channel configuration
- Check delivery logs for errors
- Ensure valid recipient information

### Webhook Failures

- Verify endpoint availability
- Check payload format and signature
- Examine response codes and errors
- Ensure proper webhook configuration

### Template Rendering Problems

- Validate variable names and formats
- Check for missing variables
- Test with sample data
- Verify template syntax