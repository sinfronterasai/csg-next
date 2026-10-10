# CSG Resend subscription setup

The repository now uses the current Resend Contacts/Segments/Topics model. It does not use deprecated Audiences.

Provider resources created in the CSG Resend account:

- Segment: `CSG — Newsletter Subscribers` — `571877a6-c10d-4111-8876-430d758c0ff0`
- Segment: `CSG — Tarot Quiz Subscribers` — `af6b5bc7-9938-42ef-9a38-5a814eb765ff`
- Topic: `CSG Weekly Insights` — `e6a9304f-95f5-4262-9220-52c9c3493903`
- Topic: `CSG Tarot Reflections` — `f074d8e1-4677-4c24-8a70-0b000a44b50a`

Published templates:

- General welcome 01: `7a8aca7a-4260-4f4f-a114-f242c39c4085`
- General welcome 02: `8b7160e3-d106-4227-9c71-5745eb973f40`
- General welcome 03: `e504541c-ec00-4285-90aa-bab5a1823265`
- Tarot welcome 01: `cabd4ad2-c590-4f90-a97e-0124f58222a2`
- Tarot welcome 02: `78eea158-3105-47e1-8f09-c81ff51b0c1e`
- Tarot welcome 03: `9ac79568-55a2-460b-9eb0-61218541b242`

Disabled automations:

- General: `01a12348-9343-71de-b12c-5d28d7b90828`
- Tarot: `01a12348-9446-7351-9adb-a72d879a6f62`

The application currently owns the durable scheduler/outbox and checks current consent before every sequence send. The provider automations remain disabled until the production deployment and end-to-end verification are complete; do not enable both systems simultaneously.

Required environment variables:

- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `RESEND_CONFIRMATION_SECRET`
- `RESEND_OUTBOX_CRON_SECRET`
- `RESEND_NEWSLETTER_SEGMENT_ID=571877a6-c10d-4111-8876-430d758c0ff0`
- `RESEND_TAROT_SEGMENT_ID=af6b5bc7-9938-42ef-9a38-5a814eb765ff`
- `RESEND_NEWSLETTER_TOPIC_ID=e6a9304f-95f5-4262-9220-52c9c3493903`
- `RESEND_TAROT_TOPIC_ID=f074d8e1-4677-4c24-8a70-0b000a44b50a`

The Resend webhook still needs to be created after this branch is deployed, because the target endpoint is `https://cosmicspiritguide.com/api/marketing/webhook` and this task intentionally does not deploy. Subscribe it to contact topic updates, bounces, complaints, failures, suppressions, and delivery delays, then copy its signing secret into `RESEND_WEBHOOK_SECRET`.

Use a scheduler/cron to call:

`POST https://cosmicspiritguide.com/api/marketing/outbox`

with `Authorization: Bearer $RESEND_OUTBOX_CRON_SECRET` every 5–15 minutes. Do not enable the disabled Resend automations until the application scheduler has been intentionally replaced or disabled.
