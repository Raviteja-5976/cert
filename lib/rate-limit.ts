/**
 * Per-email OTP cooldown. A module-level map is sufficient for a single-workshop,
 * ~130-student deployment; Supabase Auth applies its own rate limits behind this.
 */
const lastRequest = new Map<string, number>();
const COOLDOWN_MS = 60_000;

export function otpCooldownRemaining(email: string) {
  const previous = lastRequest.get(email);
  if (!previous) return 0;
  return Math.max(0, Math.ceil((COOLDOWN_MS - (Date.now() - previous)) / 1000));
}

export function markOtpRequested(email: string) {
  lastRequest.set(email, Date.now());
  if (lastRequest.size > 5000) {
    const cutoff = Date.now() - COOLDOWN_MS;
    for (const [key, value] of lastRequest) if (value < cutoff) lastRequest.delete(key);
  }
}
