const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const configHandler = require('../api/config');
const contentHandler = require('../api/content');
const { createQuoteHandler, getPublishedServiceNames } = require('../api/quote');
const originalFetch = global.fetch;
// Synthetic public fixtures only; never inspect environment credentials.
const priorURL = process.env.SUPABASE_URL;
const priorKey = process.env.SUPABASE_ANON_KEY;
afterEach(() => {
  global.fetch = originalFetch;
  if (priorURL === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = priorURL;
  if (priorKey === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = priorKey;
});
function response() {
  return {
    headers: {}, code: 200, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }
  };
}
const lead = { name: 'Test <name>', phone: '555-0100', email: 'test@example.invalid', service: 'Pavers', message: '<img src=x onerror=alert(1)>' };
test('quote success uses an injected transport, preserves addressing, and escapes HTML', async () => {
  let sent;
  const handler = createQuoteHandler(
    () => ({ emails: { send: async value => { sent = value; return { data: { id: 'test-only' }, error: null }; } } }),
    async () => ['Pavers']
  );
  const res = response(); await handler({ method: 'POST', body: lead }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.success, true);
  assert.equal(sent.to, 'greatview.hardscape@gmail.com');
  assert.equal(sent.from, 'Greatview <onboarding@resend.dev>');
  assert.ok(sent.html.includes('&lt;img'));
  assert.ok(!sent.html.includes('<img'));
});
test('quote provider errors never produce false success', async () => {
  const handler = createQuoteHandler(
    () => ({ emails: { send: async () => ({ error: { message: 'Rejected' } }) } }),
    async () => ['Pavers']
  );
  const res = response(); await handler({ method: 'POST', body: lead }, res);
  assert.equal(res.code, 502);
  assert.equal(res.body.success, undefined);
});
test('invalid quote payloads and methods never call the mail transport', async () => {
  const handler = createQuoteHandler(() => { throw new Error('Must not call transport'); }, async () => ['Pavers']);
  for (const body of [null, {}, { ...lead, email: 'invalid' }, { ...lead, service: 'Injected\nSubject' }, { ...lead, message: 'x'.repeat(5001) }]) {
    const res = response(); await handler({ method: 'POST', body }, res); assert.equal(res.code, 400);
  }
  const res = response(); await handler({ method: 'GET' }, res); assert.equal(res.code, 405);
});
test('quote requests accept newly published services and reject removed services', async () => {
  let sent;
  const handler = createQuoteHandler(
    () => ({ emails: { send: async value => { sent = value; return { error: null }; } } }),
    async () => ['Outdoor Kitchens']
  );
  const accepted = response();
  await handler({ method: 'POST', body: { ...lead, service: 'Outdoor Kitchens' } }, accepted);
  assert.equal(accepted.code, 200);
  assert.equal(sent.subject, 'New Consultation - Outdoor Kitchens');
  const rejected = response();
  await handler({ method: 'POST', body: lead }, rejected);
  assert.equal(rejected.code, 400);
});
test('quote requests do not send email if the published service list is unavailable', async () => {
  const handler = createQuoteHandler(
    () => { throw new Error('Email transport must not be called'); },
    async () => { throw new Error('Published services are unavailable'); }
  );
  const res = response();
  await handler({ method: 'POST', body: lead }, res);
  assert.equal(res.code, 503);
  assert.equal(res.body.success, undefined);
});
test('quote endpoint loads the current public service list and supports existing saved records', async () => {
  process.env.SUPABASE_URL = 'https://testproject.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'sb_publishable_test-fixture';
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => [{ content: { services: [
      { id: 'service-new', title: 'Outdoor Kitchens', description: 'Built for Arizona evenings.', icon: 'grid', image: null }
    ] } }] };
  };
  assert.deepEqual(await getPublishedServiceNames(), ['Outdoor Kitchens']);
  assert.ok(request.url.endsWith('/rest/v1/site_content?id=eq.1&select=content'));
  assert.equal(request.options.headers.apikey, 'sb_publishable_test-fixture');
  global.fetch = async () => ({
    ok: true,
    json: async () => [{ content: { services: ['old-photo-1', 'old-photo-2', 'old-photo-3', 'old-photo-4', 'old-photo-5'] } }]
  });
  assert.deepEqual(await getPublishedServiceNames(), ['Pavers', 'Artificial Turf', 'Gravel', 'Irrigation', 'Custom Designs']);
});
test('missing configuration fails closed without affecting the original public site', async () => {
  delete process.env.SUPABASE_URL; delete process.env.SUPABASE_ANON_KEY;
  const config = response(); configHandler({ method: 'GET' }, config);
  assert.equal(config.code, 503);
  const content = response(); await contentHandler({ method: 'GET' }, content);
  assert.deepEqual(content.body, { configured: false });
});
test('config never exposes a service-role or secret key even if misconfigured', () => {
  process.env.SUPABASE_URL = 'https://testproject.supabase.co';
  const jwt = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url');
  for (const key of ['sb_secret_test-fixture', `header.${jwt}.signature`, 'malformed']) {
    process.env.SUPABASE_ANON_KEY = key;
    const res = response(); configHandler({ method: 'GET' }, res);
    assert.equal(res.code, 503); assert.equal(res.body.key, undefined);
  }
});
test('published content is fetched without a service role and is not cached', async () => {
  process.env.SUPABASE_URL = 'https://testproject.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'sb_publishable_test-fixture';
  let request;
  global.fetch = async (url, options) => { request = { url, options }; return { ok: true, json: async () => [{ content: { test: true }, version: 8 }] }; };
  const res = response(); await contentHandler({ method: 'GET' }, res);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(res.body.version, 8);
  assert.ok(request.url.endsWith('/rest/v1/site_content?id=eq.1&select=content,version'));
  assert.equal(request.options.headers.apikey, 'sb_publishable_test-fixture');
});
test('provider outages and missing seed return explicit errors', async () => {
  process.env.SUPABASE_URL = 'https://testproject.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'sb_publishable_test-fixture';
  for (const mock of [async () => ({ ok: false }), async () => ({ ok: true, json: async () => [] })]) {
    global.fetch = mock;
    const res = response(); await contentHandler({ method: 'GET' }, res);
    assert.equal(res.code, 503);
  }
});
