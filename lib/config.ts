/**
 * Number of boxes rendered in the verification-code input.
 *
 * This MUST match "Email OTP Length" in the Supabase dashboard
 * (Authentication > Providers > Email). Supabase defaults to 6; set
 * NEXT_PUBLIC_OTP_LENGTH if your project uses a different length.
 *
 * Referenced statically so Next.js can inline the value at build time.
 */
const configured = Number(process.env.NEXT_PUBLIC_OTP_LENGTH);

export const OTP_LENGTH = Number.isInteger(configured) && configured >= 4 && configured <= 10 ? configured : 6;

export const emptyOtp = () => Array.from({ length: OTP_LENGTH }, () => "");
