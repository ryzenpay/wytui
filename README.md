# wytui

A self-hosted web UI for [yt-dlp](https://github.com/yt-dlp/yt-dlp), built with SvelteKit 5. Supports YouTube, TikTok, Twitter, and any yt-dlp compatible URL.

> *wytui* — pronounced "Y. T."

## Features

- **Download profiles** — Pre-configured presets (4K, 1080p, 720p, 480p, MP3, AAC, FLAC) and custom profiles
- **Two-tier storage** — Temporary cache with configurable quota + permanent library organized by uploader
- **Jellyfin integration** — Auto library scan, thumbnail artwork, and deep-link to Jellyfin search
- **Subscriptions** — Monitor channels/playlists, auto-download new videos on a schedule
- **Livestream monitors** — Watch YouTube Live and Twitch streams, auto-download when live
- **Real-time progress** — Server-Sent Events for live download status
- **OIDC authentication** — OpenID Connect SSO with admin/user roles
- **Mobile-friendly** — Web Share API on iOS for save-to-photos

## Quick Start

### Docker Compose

```yaml
services:
  wytui:
    image: ghcr.io/willuhmjs/wytui:latest
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: "postgresql://wytui:password@db:5432/wytui"
      AUTH_SECRET: "change-me-to-a-random-string"
      AUTH_TRUST_HOST: "true"
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:18
    environment:
      POSTGRES_USER: wytui
      POSTGRES_PASSWORD: password
      POSTGRES_DB: wytui
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-ONLY", "pg_isready", "-U", "wytui"]
      interval: 5s
      retries: 5

volumes:
  pgdata:
```

### Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Session signing secret |
| `AUTH_TRUST_HOST` | Set `true` behind a reverse proxy |
| `OIDC_NAME` | OIDC provider display name |
| `OIDC_CLIENT_ID` | OIDC client ID |
| `OIDC_CLIENT_SECRET` | OIDC client secret |
| `OIDC_ISSUER` | OIDC issuer URL |

## Tech Stack

- **Frontend**: SvelteKit 5 (Svelte with runes)
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: Auth.js with OIDC support
- **Real-time**: Server-Sent Events (SSE)
- **Styling**: Custom dark theme CSS

## License

MIT
