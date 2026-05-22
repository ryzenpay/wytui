# wytui

A self-hosted web UI for [yt-dlp](https://github.com/yt-dlp/yt-dlp), built with SvelteKit 5. Download videos from any yt-dlp compatible platform.

> *wytui* — pronounced "Y. T."

## ⚠️ Legal Disclaimer

**This software is provided for educational and personal use only.** Users are solely responsible for ensuring their use complies with all applicable laws, terms of service, and copyright regulations.

- Only download content you have the legal right to download
- Respect copyright laws and content creators' rights
- Do not use this tool to violate any platform's Terms of Service
- The developers assume no liability for misuse of this software
- Downloading copyrighted material without permission may be illegal in your jurisdiction

**By using this software, you agree to use it responsibly and in compliance with all applicable laws.**

## Features

- **Download profiles** — Pre-configured presets (4K, 1080p, 720p, 480p, MP3, AAC, FLAC) and custom profiles
- **Two-tier storage** — Temporary cache with configurable quota + permanent library organized by uploader
- **Jellyfin integration** — Auto library scan, thumbnail artwork, and deep-link to Jellyfin search
- **Subscriptions** — Monitor channels/playlists, auto-download new content on a schedule; backfill by date or download entire channels
- **Livestream monitors** — Watch livestreams, auto-download when live
- **File reconciliation** — Automatically detects and removes DB records for files deleted externally (e.g. via Jellyfin)
- **Real-time progress** — Server-Sent Events for live download status
- **OIDC authentication** — OpenID Connect SSO with admin/user roles
- **Mobile-friendly** — Web Share API on iOS for save-to-photos

## Quick Start

### Docker Compose

Copy `.env.example` to `.env` and fill in your values, then:

```bash
docker compose up -d
```

### Helm

```bash
helm install wytui oci://ghcr.io/willuhmjs/wytui
```

With custom values:

```bash
helm install wytui oci://ghcr.io/willuhmjs/wytui -f values.yaml
```

The chart includes a bundled PostgreSQL by default. To use an external database:

```yaml
postgresql:
  enabled: false
  secret:
    url: "postgresql://user:pass@host:5432/wytui?schema=public"
```

### Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Session signing secret |
| `AUTH_TRUST_HOST` | Set `true` behind a reverse proxy (optional) |
| `ORIGIN` | Public URL of the app (optional, defaults to `http://localhost:3000`) |
| `ADMIN_USERNAME` | Auto-create admin user, skipping the setup wizard (optional) |
| `ADMIN_PASSWORD` | Password for the auto-created admin user (optional) |
| `OIDC_ISSUER_URL` | OIDC issuer URL (optional) |
| `OIDC_CLIENT_ID` | OIDC client ID (optional) |
| `OIDC_CLIENT_SECRET` | OIDC client secret (optional) |
| `OIDC_DISPLAY_NAME` | OIDC provider display name (optional, defaults to "SSO") |

## OIDC Authentication

wytui supports OpenID Connect for single sign-on. Set the `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, and `OIDC_CLIENT_SECRET` environment variables to enable it.

When configuring your OIDC provider, use the following redirect URL:

```
https://<your-wytui-domain>/auth/oidc/callback
```

Users who sign in via OIDC are created with a default `user` role. An admin can promote them from the admin panel.

## Tech Stack

- **Frontend**: SvelteKit 5 (Svelte with runes)
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: Auth.js with OIDC support
- **Real-time**: Server-Sent Events (SSE)
- **Styling**: Custom dark theme CSS

## Additional Terms

### Intended Use

This software is intended for:
- Archiving your own content
- Downloading content explicitly licensed for redistribution
- Educational purposes and research
- Accessing content you have legal rights to

### Prohibited Use

Do not use this software to:
- Download copyrighted content without authorization
- Circumvent digital rights management (DRM)
- Violate platform Terms of Service
- Redistribute copyrighted material
- Engage in piracy or copyright infringement

### No Warranty

This software is provided "as is" without warranty of any kind. The authors and contributors are not responsible for how you use this software or any consequences of its use.

## License

MIT License - See LICENSE file for details.

**Note**: The MIT license applies to this software's code only. It does not grant rights to download, use, or distribute third-party content. Users must independently ensure they have appropriate rights to any content they download.
