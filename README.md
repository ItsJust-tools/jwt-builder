# JWT Builder

Build and sign JSON Web Tokens locally in the browser with configurable header, payload claims and HS256/HS384/HS512 signing for debugging and testing.

**Live:** [jwt-builder.itsjust.tools](https://jwt-builder.itsjust.tools)

## Features

- Editable JOSE header with `alg` (HS256/HS384/HS512) and `typ` controls
- Key/value claim editor supporting `string`, `number`, `boolean` and raw `JSON` claim types
- Registered claim helpers (`iss`, `sub`, `aud`, `exp`, `nbf`, `iat`, `jti`) with epoch and relative-time (+15m / +1h / +24h / −15m) shortcuts
- HMAC signing with a shared secret field (masked input, show/hide toggle)
- Live token preview with dot-separated segments color-coded header/payload/signature
- Decoded payload preview for verification of the resulting token
- Copy token to clipboard with toast feedback
- URL-safe state serialization so header, claims and secret are shared via link
- 100% client-side — tokens are signed in your browser with the Web Crypto API; nothing is uploaded

## How signing works

```text
base64url(header) + "." + base64url(payload)
→ HMAC-SHA256/384/512 with the shared secret
→ base64url(signature) appended as the third segment
```

## Development

```bash
npm install
npm run build -w @itsjust/core   # build shared core first
npm run dev
npm test
```

## Deployment

```bash
docker build -t itsjust-jwt-builder .
docker run -p 3000:3000 itsjust-jwt-builder
```

## License

MIT
