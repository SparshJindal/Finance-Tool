import NextAuth from "next-auth"
import Resend from "next-auth/providers/resend"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      async sendVerificationRequest({ identifier, url, provider }) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const urlObj = new URL(url)
        const token = urlObj.searchParams.get('token')
        const email = urlObj.searchParams.get('email')
        const wrappedUrl = `${appUrl}/auth/confirm?token=${token}&email=${encodeURIComponent(email || '')}`

        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sign in to coranto</title>
</head>
<body style="margin:0;padding:0;background-color:#F9FAFB;font-family:'Georgia','Times New Roman',Times,serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F9FAFB;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          <!-- Warm gradient top bar -->
          <tr>
            <td style="height:3px;background:linear-gradient(90deg,#5D4037,#A0845C);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="padding:36px 40px 0 40px;text-align:center;">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#0A1128;font-family:'Georgia','Times New Roman',Times,serif;letter-spacing:-0.3px;">
                coranto
              </h1>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding:20px 40px 0 40px;">
              <hr style="border:none;border-top:1px solid #E5E7EB;margin:0;" />
            </td>
          </tr>
          <!-- Greeting -->
          <tr>
            <td style="padding:28px 40px 0 40px;text-align:center;">
              <h2 style="margin:0;font-size:18px;font-weight:600;color:#5D4037;font-family:'Georgia','Times New Roman',Times,serif;">
                Your secure access link
              </h2>
            </td>
          </tr>
          <!-- Body text -->
          <tr>
            <td style="padding:16px 40px 0 40px;text-align:center;">
              <p style="margin:0;font-size:15px;line-height:24px;color:#475569;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                Click the button below to securely sign in to your coranto dashboard. This link expires in 24 hours.
              </p>
            </td>
          </tr>
          <!-- CTA Button -->
          <tr>
            <td style="padding:32px 40px 0 40px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td align="center" style="border-radius:6px;background:linear-gradient(180deg,#5D4037,#4E342E);">
                    <a href="${wrappedUrl}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:'Georgia','Times New Roman',Times,serif;font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:6px;border:1px solid #4E342E;">
                      Sign in to your portfolio
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Fallback URL -->
          <tr>
            <td style="padding:32px 40px 0 40px;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:13px;color:#6B7280;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                Or copy and paste this URL into your browser:
              </p>
              <p style="margin:0;font-size:12px;line-height:18px;color:#9CA3AF;font-family:monospace;word-break:break-all;">
                <a href="${wrappedUrl}" style="color:#9CA3AF;text-decoration:underline;">${wrappedUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Footer space inside card -->
          <tr>
            <td style="padding:40px;">&nbsp;</td>
          </tr>
        </table>
        <!-- Outside Footer -->
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;margin-top:24px;">
          <tr>
            <td align="center">
              <p style="margin:0;font-size:12px;color:#9CA3AF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                If you didn't request this email, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim()

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: provider.from,
            to: identifier,
            subject: `Sign in to coranto`,
            html: htmlContent,
          }),
        })
      },
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string }
        })

        if (!user || !user.passwordHash) {
          return null
        }

        const passwordsMatch = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )

        if (passwordsMatch) {
          return user
        }

        return null
      }
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/auth/verify-request",
  },
})
