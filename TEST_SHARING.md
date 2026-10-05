# Temporary laptop testing

User preference recorded on 2026-10-03: share this laptop's site with testers temporarily. When testing ends or the user returns to live deployment, stop the temporary tunnel and remove its setup if requested. Keep production configuration independent; never hardcode the test hostname into application source or production environment files.

Start the existing local backend from `backend/` with `npm start` if it is not already running. Then, from the project root:

```powershell
npm run share:test
```

Share the printed HTTPS link. The script builds the frontend with same-origin API requests and shares a temporary preview on port 5001 using Cloudflare Quick Tunnel. API requests go to the existing backend on port 5000. Laptop, internet and backend must remain running. Running again while a tunnel is active returns the existing link; stop first to rebuild after edits.

```powershell
npm run share:stop
```

Stopping revokes sharing and leaves the local backend running. Restarting creates a new hostname. Local tunnel executable, logs and process state are in ignored `.test-share/`; no Windows service or automatic startup is installed. The frontend build in ignored `frontend/dist/` is regenerated; production deployment must run its usual build with production settings.

Testers use the backend's current database and enabled integrations. This setup does not create or switch to a separate test database. Anyone with the link can reach the application; its normal account permissions still apply.

To remove the setup permanently: run `npm run share:stop`, remove the two `share:*` package scripts, `scripts/share-test.ps1`, `scripts/test-preview.js`, and the local `.test-share/` folder. No tunnel hostname is stored in production configuration.

Official documentation: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/

SEO preview fix: sharing now uses the temporary `scripts/test-preview.js` server on loopback port 5001. It forwards API requests to the existing backend on port 5000 and renders catalog pages using the current tunnel origin from `.test-share/tunnel.json`. Preview pages send noindex headers and robots disallow crawling. `share:stop` stops both temporary processes. Production SEO settings and the existing backend process remain independent. Remove `scripts/test-preview.js` too when removing temporary sharing.
