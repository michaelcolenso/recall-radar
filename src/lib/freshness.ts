/** Reject invalid/future source timestamps instead of substituting today's date. */
export function verifiedTimestamp(value?: string | null, now = new Date()): string | undefined {
 if (!value) return undefined;
 const date = new Date(value);
 return Number.isFinite(date.getTime()) && date.getTime() <= now.getTime() ? date.toISOString() : undefined;
}
