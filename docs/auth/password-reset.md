# Password reset security contract

The password reset flow uses Resend server-side with `RESEND_API_KEY` and sends from `Cosmic Spirit Guide <noreply@cosmicspiritguide.com>`.

Reset links are built only from the HTTPS `APP_BASE_URL` environment variable. Request `Host`, `Origin`, and `Referer` headers are never used as reset-link authority.

Reset tokens contain 256 bits of cryptographically random data. Only the SHA-256 token hash is stored in PostgreSQL. Tokens expire after 30 minutes, are single-use, and issuing a new token revokes earlier outstanding tokens for the same user.

Forgot-password responses are generic for valid email-shaped input. The PostgreSQL-backed limiter allows at most 3 requests per normalized email hash and 10 requests per trusted client-IP hash per rolling hour. Request rows retain hashes only and are cleaned after 24 hours. Render's managed proxy supplies `X-Forwarded-For`; the implementation accepts only a syntactically valid first address and falls back to `X-Real-IP`. If no valid address is available, the email limiter still applies and the IP limiter is not guessed from request-controlled host data.

A known Resend delivery failure revokes the newly created token without exposing provider details. The public response remains generic.

Password changes reuse bcryptjs and the existing 8-character minimum. Password reset does not revoke existing JWT sessions in v1; existing 7-day `auth_token` cookies remain valid until their normal expiration. Global session revocation is intentionally deferred to a separate security-hardening change.
