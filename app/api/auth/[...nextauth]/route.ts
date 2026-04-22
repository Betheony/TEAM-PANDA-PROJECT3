import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

const allowedGoogleEmails = (process.env.ALLOWED_GOOGLE_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== 'google') {
        return true;
      }

      const email = profile?.email?.toLowerCase();
      if (!email) {
        return false;
      }

      if (allowedGoogleEmails.length === 0) {
        return false;
      }

      return allowedGoogleEmails.includes(email);
    },
  },
});

export { handler as GET, handler as POST };
