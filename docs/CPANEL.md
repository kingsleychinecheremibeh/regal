# Deploying on cPanel

Both the website (`apps/web`) and the API (`apps/api`) run on cPanel as two Node.js apps. The database stays on Neon. Visitors only ever see the main domain: the website forwards `/api/v1/*` to the API subdomain, so login cookies stay on the main domain.

```text
browser ──https──▶ turboxglobal.com (Next.js) ──/api/v1──▶ api.turboxglobal.com (NestJS) ──wss:443──▶ Neon
```

This guide matches the Namecheap shared hosting account `turbudce` (CloudLinux 8, SSH on port 21098). Notes for other hosts are at the end.

## Requirements

- **Node.js 22 or newer** in _Setup Node.js App_. The API's Neon driver uses Node's built-in WebSocket.
- HTTPS on both the domain and the API subdomain (AutoSSL is enough). Login cookies are `Secure` in production and will not work over plain HTTP.
- SSH access (cPanel → _Manage Shell_ → enable) with a key authorised under _SSH Access_. The examples use this `~/.ssh/config` entry:

  ```text
  Host turboxglobal
    HostName turboxglobal.com
    Port 21098
    User turbudce
    IdentityFile ~/.ssh/turboxglobal_cpanel
  ```

Namecheap blocks outbound port 5432, so the API reaches Neon through Neon's WebSocket proxy on port 443 (`DATABASE_DRIVER=neon-websocket`).

## 1. Build the upload packages (on your computer)

From the repository root, in PowerShell:

```powershell
# API
pnpm.cmd --filter @regalvest/api build
pnpm.cmd --filter @regalvest/api package:cpanel

# Website (API_PROXY_TARGET is fixed into the build; rebuild if it changes)
$env:API_PROXY_TARGET = "https://api.turboxglobal.com"
pnpm.cmd --filter @regalvest/web build
pnpm.cmd --filter @regalvest/web package:cpanel
```

| Zip                                         | Contents                                               |
| ------------------------------------------- | ------------------------------------------------------ |
| `apps/api/dist-cpanel/turboxglobal-api.zip` | `app/` (startup file `dist/main.js`) + `node_modules/` |
| `apps/web/dist/cpanel/turboxglobal-web.zip` | `app/` (startup file `server.js`) + `node_modules/`    |

In both, `node_modules/` sits one level **above** `app/` on purpose: cPanel's Node.js selector does not allow a `node_modules` folder inside the application root.

## 2. Upload and prepare (over SSH)

```sh
scp apps/api/dist-cpanel/turboxglobal-api.zip apps/web/dist/cpanel/turboxglobal-web.zip turboxglobal:~/
ssh turboxglobal
```

On the server:

```sh
export PATH=/opt/alt/alt-nodejs22/root/usr/bin:$PATH
for app in api web; do
  mkdir -p ~/turboxglobal-$app && cd ~/turboxglobal-$app
  unzip -qo ~/turboxglobal-$app.zip && rm ~/turboxglobal-$app.zip
  # Zips made on Windows extract world-writable; tighten them.
  find . -type d -exec chmod 755 {} + && find . -type f -exec chmod 644 {} +
done

# argon2's prebuilt binary needs glibc 2.34; CloudLinux 8 has 2.28. Compile it
# here (system Python 3.6 is too old for node-gyp, so use the alt Python).
cd ~/turboxglobal-api/node_modules/argon2
npx --yes node-gyp@11 rebuild --python=/opt/alt/python313/bin/python3.13
cd ~/turboxglobal-api/app && node -e 'require("argon2").hash("x").then(() => console.log("argon2 ok"))'
```

Re-run the argon2 step whenever a new API zip is extracted.

## 3. Create the API subdomain

In cPanel **Domains**, create `api.turboxglobal.com` (any document root; it is not used). Then cPanel → **SSL/TLS Status** → _Run AutoSSL_ and wait until the subdomain shows a valid certificate.

## 4. Create the two Node.js apps

In **Setup Node.js App** → **Create Application**, once for each:

| Field                    | API                    | Website                |
| ------------------------ | ---------------------- | ---------------------- |
| Node.js version          | 22 (or newer)          | 22 (or newer)          |
| Application mode         | Production             | Production             |
| Application root         | `turboxglobal-api/app` | `turboxglobal-web/app` |
| Application URL          | `api.turboxglobal.com` | `turboxglobal.com`     |
| Application startup file | `dist/main.js`         | `server.js`            |

API environment variables:

| Name               | Value                                      |
| ------------------ | ------------------------------------------ |
| `NODE_ENV`         | `production`                               |
| `DATABASE_URL`     | your Neon connection string (keep private) |
| `DATABASE_DRIVER`  | `neon-websocket`                           |
| `CORS_ORIGINS`     | `https://turboxglobal.com`                 |
| `PUBLIC_WEB_URL`   | `https://turboxglobal.com`                 |
| `TRUST_PROXY_HOPS` | `1`                                        |
| `DEMO_MODE`        | `true`                                     |
| `RESEND_API_KEY`   | only if you use email (optional)           |
| `EMAIL_FROM`       | only if you use email (optional)           |

Website environment variables:

| Name               | Value                          |
| ------------------ | ------------------------------ |
| `NODE_ENV`         | `production`                   |
| `API_PROXY_TARGET` | `https://api.turboxglobal.com` |
| `HOSTNAME`         | `127.0.0.1`                    |

Click **Create**, then **Restart**, for each. **Do not** click _Run NPM Install_; the dependencies are already included.

`HOSTNAME` matters: Next.js listens on whatever `HOSTNAME` says, and on many servers it is set to the machine name by default.

## 5. Check

- `https://api.turboxglobal.com/api/v1/health` returns `{"status":"ok",...}`.
- `https://turboxglobal.com/` loads with styling.
- `https://turboxglobal.com/api/v1/health` returns the same health response (website → API).
- Sign in, reload the dashboard, and sign out.

## Updating later

Rebuild and repackage, upload the new zip, repeat step 2 for that app (including the argon2 build for the API), then **Restart** the app in _Setup Node.js App_.

## Troubleshooting

| Symptom                                                      | Likely cause                                                                                                                                  |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 503 or "Incomplete response"                                 | The app failed to start. Open `stderr.log` in the application root. Check the Node version (22+) and that `node_modules` sits next to `app/`. |
| API `stderr.log` says `Invalid environment: …`               | The named variable is missing or wrong in the API's environment variables. `PUBLIC_WEB_URL` must start with `https://`.                       |
| API `stderr.log` mentions `GLIBC_2.34` / `argon2`            | The argon2 compile step in section 2 was skipped after a new upload.                                                                          |
| API health returns 503                                       | The database is unreachable. Check `DATABASE_URL` and that `DATABASE_DRIVER` is `neon-websocket`.                                             |
| Pages load but sign-in fails with "Invalid request origin"   | API `CORS_ORIGINS` does not exactly match `https://turboxglobal.com`.                                                                         |
| Sign-in succeeds but the dashboard sends you back to sign-in | The site is served over HTTP, so the browser drops the `Secure` cookie. Enable HTTPS.                                                         |

## Other hosts

If the host allows outbound port 5432, leave `DATABASE_DRIVER` unset to use the standard PostgreSQL driver. If its glibc is 2.34 or newer (`ldd --version`), argon2's prebuilt binary works and the compile step can be skipped.
