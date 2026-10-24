# Deploying the website on cPanel

The site (`apps/web`) runs on cPanel as a Node.js app. The API stays on Render and the database stays on Neon. Visitors only ever see the cPanel domain: the site forwards `/api/v1/*` to the API, so login cookies stay on your domain.

```
browser ──https──▶ cPanel (Next.js) ──/api/v1──▶ Render (API) ──▶ Neon (PostgreSQL)
```

## Requirements

- cPanel with **Setup Node.js App** offering **Node.js 20.9 or newer**.
- HTTPS on the domain (AutoSSL is enough). Login cookies are `Secure` in production and will not work over plain HTTP.

## 1. Build the upload package (on your computer)

From the repository root, in PowerShell:

```powershell
$env:API_PROXY_TARGET = "https://regalvest-api.onrender.com"
pnpm.cmd --filter @regalvest/web build
pnpm.cmd --filter @regalvest/web package:cpanel
```

This creates `apps/web/dist/cpanel/turboxglobal-web.zip`, about 5 MB. `API_PROXY_TARGET` is fixed into the build, so rebuild if the API address changes.

The zip contains:

- `app/`: the application. `server.js` is the startup file.
- `node_modules/`: dependencies, kept one level **above** the app on purpose. cPanel's Node.js selector does not allow a `node_modules` folder inside the application root.

## 2. Upload

1. In cPanel **File Manager**, create a folder in your home directory, outside `public_html`, for example `turboxglobal-web`.
2. Upload the zip into it and **Extract**. You should now have:
   - `~/turboxglobal-web/app/server.js`
   - `~/turboxglobal-web/node_modules/next`

## 3. Create the Node.js app

Open **Setup Node.js App** and select **Create Application**:

| Field                    | Value                      |
| ------------------------ | -------------------------- |
| Node.js version          | 20.x or newer              |
| Application mode         | Production                 |
| Application root         | `turboxglobal-web/app`     |
| Application URL          | your domain (or subdomain) |
| Application startup file | `server.js`                |

Add these environment variables:

| Name               | Value                                |
| ------------------ | ------------------------------------ |
| `NODE_ENV`         | `production`                         |
| `API_PROXY_TARGET` | `https://regalvest-api.onrender.com` |
| `HOSTNAME`         | `127.0.0.1`                          |

Then click **Create** and **Restart**.

- **Do not** click _Run NPM Install_; the dependencies are already included.
- `HOSTNAME` matters: Next.js listens on whatever `HOSTNAME` says, and on many servers it is set to the machine name by default.

## 4. Point the API at the new domain

In the Render dashboard, open the **API** service → _Environment_ and set:

- `CORS_ORIGINS`: `https://your-domain` (comma-separate it from any existing origins you still use)
- `PUBLIC_WEB_URL`: `https://your-domain`

Save. Render redeploys the API.

The API rejects sign-ins and every other state-changing request from any origin not listed in `CORS_ORIGINS`.

## 5. Check

- `https://your-domain/` loads with styling.
- `https://your-domain/api/v1/health` returns `{"status":"ok",...}`. The first request can take up to a minute while Render Free wakes up.
- Sign in, reload the dashboard, and sign out.

## Updating later

Rebuild and repackage, upload the new zip, extract over the old folder, then **Restart** the app in _Setup Node.js App_.

## Troubleshooting

| Symptom                                                      | Likely cause                                                                                                                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 503 or "Incomplete response"                                 | The app failed to start. Open the app's `stderr.log` in the application root. Check the Node version (20.9+) and that `node_modules` sits next to `app/`, not inside it. |
| Pages load but sign-in fails with "Invalid request origin"   | `CORS_ORIGINS` on Render does not exactly match `https://your-domain`.                                                                                                   |
| Sign-in succeeds but the dashboard sends you back to sign-in | The site is served over HTTP, so the browser drops the `Secure` cookie. Enable HTTPS.                                                                                    |
| `/api/v1/health` times out                                   | The Render API is asleep or down. Retry after a minute.                                                                                                                  |
