import { env } from './lib/env.js';
import { createApp } from './app.js';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`[api] listening on http://localhost:${env.PORT}/api/v1  (TZ=${env.TZ})`);
});

const BASE = process.env.EXPO_PUBLIC_API_BASE_URL;
console.log('[BxB API BASE]', BASE);