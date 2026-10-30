// Browser-only test double. Never imported by application code or copied into dist.
// Intercepts every request to the synthetic Supabase host; no email is sent.
import { readFile } from 'node:fs/promises';
import { initialContent } from '../shared/content.mjs';
const data = JSON.parse(await readFile(new URL('../data.json', import.meta.url), 'utf8'));
export async function installOwnerMock(page, options = {}) {
  const role = options.role || 'owner';
  const userId = role === 'editor' ? '22222222-2222-4222-a222-222222222222' : '11111111-1111-4111-a111-111111111111';
  const state = { content: initialContent(data), version: 1, canEdit: options.canEdit !== false, role, uploads: [], saves: 0, resetRequests: 0, passwordUpdates: 0, calls: [] };
  const files = new Map();
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: `${role}@example.invalid`, email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: new Date().toISOString() };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.test-only-not-signed`;
  await page.route('**/api/config', route => route.fulfill({ json: { url: 'https://testproject.supabase.co', key: 'sb_publishable_test-fixture' } }));
  await page.route('**/api/content', route => route.fulfill({ json: { configured: true, content: state.content, version: state.version } }));
  await page.route('https://testproject.supabase.co/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    state.calls.push(`${request.method()} ${url.pathname}`);
    if (url.pathname === '/auth/v1/token') {
      const body = request.postDataJSON();
      if (url.searchParams.get('grant_type') !== 'password' || !body.email || !body.password) {
        throw new Error('Expected email/password sign-in without account creation');
      }
      return route.fulfill({ json: { access_token: token, refresh_token: 'test-only-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user } });
    }
    if (url.pathname === '/auth/v1/user') {
      if (request.method() !== 'GET' && request.postDataJSON()?.password) state.passwordUpdates++;
      return route.fulfill({ json: user });
    }
    if (url.pathname === '/auth/v1/recover') { state.resetRequests++; return route.fulfill({ json: {} }); }
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
    if (url.pathname === '/rest/v1/rpc/can_edit_site') return route.fulfill({ json: state.canEdit });
    if (url.pathname === '/rest/v1/site_content') return route.fulfill({ json: { content: state.content, version: state.version } });
    if (url.pathname === '/rest/v1/rpc/publish_site') {
      const body = request.postDataJSON();
      if (!state.canEdit) return route.fulfill({ status: 403, json: { code: '42501', message: 'Not an approved editor' } });
      if (body.expected_version !== state.version) return route.fulfill({ status: 409, json: { code: '40001', message: 'Conflict' } });
      state.content = structuredClone(body.new_content); state.version++; state.saves++;
      return route.fulfill({ json: state.version });
    }
    const storagePath = url.pathname.replace('/storage/v1/object/', '');
    if (request.method() === 'POST' && storagePath.startsWith('site-photos/')) {
      let buffer = request.postDataBuffer();
      const type = request.headers()['content-type'];
      let imageType = type;
      if (type.startsWith('multipart/form-data')) {
        const boundary = type.split('boundary=')[1].replace(/^"|"$/g, '');
        const header = /Content-Type: image\/webp\r\n\r\n/i.exec(buffer.toString('latin1'));
        if (!header) throw new Error('Optimized WebP part missing from upload');
        const start = header.index + header[0].length;
        const end = buffer.indexOf(Buffer.from(`\r\n--${boundary}`), start);
        buffer = buffer.subarray(start, end);
        imageType = 'image/webp';
      }
      files.set(storagePath, buffer); state.uploads.push({ path: storagePath, bytes: buffer.length, type: imageType });
      return route.fulfill({ json: { Key: storagePath, Id: 'test-only' } });
    }
    if (storagePath.startsWith('public/site-photos/')) {
      const image = files.get(storagePath.replace('public/', ''));
      return image ? route.fulfill({ contentType: 'image/webp', body: image }) : route.fulfill({ status: 404 });
    }
    throw new Error(`Unexpected test request: ${request.method()} ${url.pathname}`);
  });
  return state;
}
