/**
 * Supabase Edge Function for Push Notifications
 * 
 * This function handles sending push notifications through Expo's push notification service.
 * It can be triggered by database webhooks or direct API calls.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Define interfaces for the webhook payload
interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Notification;
  schema: 'public';
  old_record: null | Notification;
}

// Create Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get Expo access token from environment
const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN')!;

// Handler function
Deno.serve(async (req) => {
  try {
    // Check if this is a webhook or direct API call
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      // Parse the request body
      const body = await req.json();
      
      // Check if this is a webhook payload
      if (body.type && body.table && body.record) {
        return await handleWebhook(body);
      } else {
        // This is a direct API call
        return await handleDirectCall(body, req);
      }
    }
    
    // Invalid request
    return new Response(
      JSON.stringify({ error: 'Invalid request' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`Error processing request: ${error}`);
    
    return new Response(
      JSON.stringify({ error: `Failed to process request: ${error.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Handle webhook payload from database
 * @param payload Webhook payload
 * @returns Response
 */
async function handleWebhook(payload: WebhookPayload): Promise<Response> {
  console.log('Processing webhook payload:', JSON.stringify(payload));
  
  // Only process INSERT events
  if (payload.type !== 'INSERT') {
    return new Response(
      JSON.stringify({ message: `Ignoring ${payload.type} event` }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Get the notification record
  const notification = payload.record;
  
  // Get user's push token
  const { data, error } = await supabase
    .from('profiles')
    .select('expo_push_token')
    .eq('id', notification.user_id)
    .single();
  
  if (error || !data?.expo_push_token) {
    console.error(`Failed to get push token for user ${notification.user_id}: ${error?.message || 'No token found'}`);
    
    return new Response(
      JSON.stringify({ error: 'Failed to get push token' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Send push notification
  const pushResult = await sendPushNotification({
    to: data.expo_push_token,
    title: notification.title,
    body: notification.body,
    data: notification.data || {},
    sound: 'default'
  });
  
  return new Response(
    JSON.stringify(pushResult),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Handle direct API call
 * @param body Request body
 * @param req Original request
 * @returns Response
 */
async function handleDirectCall(body: any, req: Request): Promise<Response> {
  console.log('Processing direct API call');
  
  // Verify authentication
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  const token = authHeader.split(' ')[1];
  
  // Verify the token
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid token' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Validate required fields
  if (!body.to || !body.title || !body.body) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: to, title, body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Send push notification
  const pushResult = await sendPushNotification({
    to: body.to,
    title: body.title,
    body: body.body,
    data: body.data || {},
    sound: body.sound || 'default',
    badge: body.badge,
    channelId: body.channelId,
    priority: body.priority || 'high',
    ttl: body.ttl,
    expiration: body.expiration,
    subtitle: body.subtitle
  });
  
  return new Response(
    JSON.stringify({ success: true, data: pushResult }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Send push notification via Expo
 * @param message Push notification message
 * @returns Push notification result
 */
async function sendPushNotification(message: any): Promise<any> {
  try {
    // Prepare the message
    const messages = Array.isArray(message.to)
      ? message.to.map((token: string) => ({ ...message, to: token }))
      : [message];
    
    // Send to Expo Push API
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Authorization': `Bearer ${expoAccessToken}`
      },
      body: JSON.stringify(messages)
    });
    
    if (!response.ok) {
      throw new Error(`Expo API error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Push notification sent:', JSON.stringify(result));
    
    return result;
  } catch (error) {
    console.error(`Failed to send push notification: ${error}`);
    throw error;
  }
}
