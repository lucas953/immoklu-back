# Immoklu Backend

NestJS modular monolith for the Immoklu API.

## Main modules

- `auth`
- `users`
- `workspace`
- `properties`
- `tenants`
- `leases`
- `payments`
- `expenses`
- `documents`
- `reports`
- `dashboard`

## Commands

```powershell
npm.cmd install
npm.cmd run prisma:generate
Copy-Item .env.example .env
npm.cmd run prisma:migrate
npm.cmd run dev
npm.cmd run test
```

## Notes

- API base path is `/v1`.
- Production CORS is controlled by `APP_ORIGIN`; set it to the deployed frontend origin, for example `https://immoklu-front-web.vercel.app`.
- Prisma schema lives at [`prisma/schema.prisma`](./prisma/schema.prisma).
- Object storage is designed around S3-compatible providers such as Cloudflare R2.
- Auth uses httpOnly access and refresh cookies.
- Password reset currently returns the raw reset token only in non-production environments so the MVP can be tested before email delivery is implemented.
