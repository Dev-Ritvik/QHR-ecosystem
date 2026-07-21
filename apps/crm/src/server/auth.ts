import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, phoneNumber } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { coreSchema } from "@estate/db";

const sql = postgres(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema: coreSchema });

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    // The adapter resolves model names against these keys (pluralized via
    // usePlural): users, sessions, accounts, verifications, passkeys.
    schema: coreSchema,
    usePlural: true,
  }),
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "agent",
        input: false, // not settable via signup — DB default or admin-set only
      },
    },
  },
  session: {
    expiresIn: 30 * 24 * 60 * 60, // 30-day idle expiry (NFR-S5)
    updateAge: 24 * 60 * 60,
  },
  advanced: {
    database: {
      // users.id / sessions.id are uuid columns; better-auth's default
      // 32-char string ids fail with "invalid input syntax for type uuid"
      generateId: "uuid",
    },
  },
  plugins: [
    passkey(),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }: { email: string, otp: string, type: string }) {
        if (!process.env.EMAIL_API_KEY) {
          console.warn(`[DEV] Would send OTP ${otp} to ${email}`);
          return;
        }
        
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.EMAIL_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'office@example.com',
            to: email,
            subject: 'CRM Verification Code',
            html: `<p>Your verification code is: <strong>${otp}</strong></p>`
          })
        });
      },
    }),
    phoneNumber({
      async sendOTP({ phoneNumber, code }: { phoneNumber: string, code: string }) {
        if (!process.env.SMS_API_KEY) {
          console.warn(`[DEV] Would send SMS OTP ${code} to ${phoneNumber}`);
          return;
        }

        // Generic integration stub for an Indian DLT-registered SMS provider
        await fetch('https://api.msg91.com/api/v5/otp', {
          method: 'POST',
          headers: {
            'authkey': process.env.SMS_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            template_id: 'auth_otp',
            mobile: phoneNumber.replace('+', ''),
            otp: code,
            sender: process.env.SMS_SENDER_ID
          })
        });
      },
    }),
  ],
});
