/**
 * Password Reset Email Template
 * 
 * This template is used for sending password reset emails.
 */

/**
 * Generate the HTML content for a password reset email
 * @param resetUrl The URL for resetting the password
 * @param username The user's name or email
 * @returns HTML content for the email
 */
export const generatePasswordResetHtml = (resetUrl: string, username: string): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f9f9f9;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          padding: 20px 0;
          border-bottom: 1px solid #eee;
        }
        .content {
          padding: 20px 0;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background-color: #4a6cf7;
          color: #ffffff !important;
          text-decoration: none;
          border-radius: 4px;
          font-weight: bold;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          padding: 20px 0;
          color: #888;
          font-size: 0.8em;
          border-top: 1px solid #eee;
        }
        .note {
          background-color: #f8f8f8;
          padding: 15px;
          border-radius: 4px;
          margin: 20px 0;
          font-size: 0.9em;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Reset Your Password</h1>
        </div>
        <div class="content">
          <p>Hello ${username},</p>
          <p>We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>
          <p>To reset your password, click the button below:</p>
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </div>
          <div class="note">
            <p>This link will expire in 1 hour for security reasons.</p>
            <p>If the button above doesn't work, copy and paste the following URL into your browser:</p>
            <p style="word-break: break-all;">${resetUrl}</p>
          </div>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} KAI. All rights reserved.</p>
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate the plain text content for a password reset email
 * @param resetUrl The URL for resetting the password
 * @param username The user's name or email
 * @returns Plain text content for the email
 */
export const generatePasswordResetText = (resetUrl: string, username: string): string => {
  return `
    Reset Your Password
    
    Hello ${username},
    
    We received a request to reset your password. If you didn't make this request, you can safely ignore this email.
    
    To reset your password, visit the following link:
    ${resetUrl}
    
    This link will expire in 1 hour for security reasons.
    
    © ${new Date().getFullYear()} KAI. All rights reserved.
    This is an automated message, please do not reply to this email.
  `;
};

export default {
  generatePasswordResetHtml,
  generatePasswordResetText
};
