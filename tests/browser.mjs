import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { installOwnerMock } from './browser-mocks.mjs';

// Optional executable argument supports a system Chromium without downloading a browser.
const browser = await chromium.launch({ headless: true, ...(process.argv[2] ? { executablePath: process.argv[2] } : {}), args: ['--no-sandbox'] });
const baseURL = process.argv[3] || 'http://127.0.0.1:5000';
await mkdir('generated-artifacts/browser', { recursive: true });
let checks = 0;
const check = async (label, fn) => { await fn(); checks++; console.log(`PASS: ${label}`); };
async function signIn(page, emailAddress = 'owner@example.invalid') {
  await page.goto(`${baseURL}/admin`);
  await page.locator('#email').fill(emailAddress);
  await page.locator('#password').fill('preview-only-test-password');
  await page.locator('#sign-in').click();
}
try {
  const baseline = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await baseline.goto(`${baseURL}/admin`);
  await check('unconfigured admin is locked', async () => {
    await expect(baseline.locator('#setup-panel')).toBeVisible();
    await expect(baseline.locator('#editor')).toBeHidden();
  });
  await baseline.goto(baseURL);
  await check('original website loads all services and gallery images', async () => {
    await expect(baseline.locator('#services-grid > div')).toHaveCount(5);
    await expect(baseline.locator('#gallery-grid > div')).toHaveCount(10);
    await expect(baseline.locator('.hero-reveal')).toHaveCSS('opacity', '1');
    await expect(baseline.locator('#business-license')).toBeHidden();
  });
  await baseline.screenshot({ path: 'generated-artifacts/browser/homepage-desktop.png' });
  await baseline.locator('header button').click();
  await check('quote modal and local no-email guard work', async () => {
    await baseline.getByPlaceholder('Your Name').fill('Browser test');
    await baseline.getByPlaceholder('Phone Number').fill('555-0100');
    await baseline.getByPlaceholder('Email Address').fill('test@example.invalid');
    let alertMessage = '';
    baseline.once('dialog', async dialog => { alertMessage = dialog.message(); await dialog.accept(); });
    await baseline.locator('#modal-quote-form button[type=submit]').click();
    await expect.poll(() => alertMessage).toContain('Email sending is disabled');
    await expect(baseline.locator('#success-message')).toBeHidden();
  });
  await baseline.close();

  for (const [name, viewport] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 1000 }]]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    const role = name === 'desktop' ? 'editor' : 'owner';
    const state = await installOwnerMock(page, { role });
    await page.goto(`${baseURL}/admin`);
    await page.locator('#email').fill(`${role}@example.invalid`);
    await page.locator('#request-password-reset').click();
    await expect(page.locator('#login-status')).toContainText('If that email has an invited account');
    await check(`${name}: password reset is requested without revealing account status`, async () => {
      expect(state.resetRequests).toBe(1);
    });
    await signIn(page, `${role}@example.invalid`);
    await page.goto(`${baseURL}/admin?recover=1`);
    await expect(page.locator('#password-recovery-panel')).toBeVisible();
    await page.locator('#new-password').fill('preview-only-new-password');
    await page.locator('#confirm-password').fill('preview-only-new-password');
    await page.locator('#save-password').click();
    await expect(page.locator('#editor')).toBeVisible();
    await check(`${name}: secure recovery session can set a new password`, async () => {
      expect(state.passwordUpdates).toBe(1);
    });
    await page.locator('#logout').click();
    await signIn(page, `${role}@example.invalid`);
    await check(`${name}: ${role} signs in and sees real existing photos`, async () => {
      await expect(page.locator('#editor')).toBeVisible();
      await expect(page.locator('#main-photos .photo-card')).toHaveCount(6);
      await expect(page.locator('#gallery-photos .photo-card')).toHaveCount(10);
      await expect(page.locator('#featured-photos .photo-card')).toHaveCount(1);
      expect(await page.locator('#main-photos img').first().getAttribute('src')).toBe(state.content.hero);
      await expect.poll(() => page.locator('#main-photos img').first().evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('#save')).toBeVisible();
    });
    await page.screenshot({ path: `generated-artifacts/browser/admin-${name}.png` });
    await page.locator('#gallery-photos .photo-preview').first().click();
    page.once('dialog', dialog => dialog.dismiss());
    await page.locator('#delete-photo').click();
    await check(`${name}: cancelled deletion preserves draft`, async () => {
      await expect(page.locator('#photo-dialog')).toBeVisible();
      await expect(page.locator('#gallery-photos .photo-card')).toHaveCount(10);
    });
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#delete-photo').click();
    await check(`${name}: deletion stays unpublished until Save`, async () => {
      await expect(page.locator('#gallery-photos .photo-card')).toHaveCount(9);
      expect(state.content.gallery.length).toBe(10);
    });
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#discard').click();
    await expect(page.locator('#gallery-photos .photo-card')).toHaveCount(10);

    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 3200; canvas.height = 1600;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#c57b57'; ctx.fillRect(0, 0, 3200, 1600);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    const photo = { name: 'phone-photo.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') };
    let chooser = page.waitForEvent('filechooser');
    await page.locator('#main-photos .photo-preview').first().click();
    await page.locator('#replace-photo').click();
    await (await chooser).setFiles(photo);
    await expect(page.locator('#editor-status')).toContainText('Photo ready');
    await check(`${name}: phone photo is optimized and replacement remains a draft`, async () => {
      expect(state.uploads.length).toBe(1);
      expect(state.uploads[0].path).toMatch(/\.webp$/);
      expect(state.uploads[0].type).toBe('image/webp');
      expect(state.uploads[0].bytes).toBeLessThan(5 * 1024 * 1024);
      const img = page.locator('#main-photos img').first();
      await img.scrollIntoViewIfNeeded();
      await expect(img).toHaveAttribute('src', /site-photos/);
      await expect(img).toHaveJSProperty('naturalWidth', 2400);
      expect(state.content.hero).not.toContain('site-photos');
    });
    chooser = page.waitForEvent('filechooser');
    await page.locator('#add-gallery').click();
    await (await chooser).setFiles([photo, { ...photo, name: 'another-phone-photo.png' }]);
    await expect(page.locator('#editor-status')).toContainText('2 photos ready');
    await expect(page.locator('#gallery-photos .photo-card')).toHaveCount(12);
    await page.locator('#gallery-photos .photo-card').first().getByRole('button', { name: 'Move Project 1 later', exact: true }).click();
    expect(await page.locator('#gallery-photos .photo-card').nth(1).getAttribute('data-photo-id')).toBe('original-1');
    if (name === 'desktop') {
      await page.locator('#gallery-photos .photo-card').nth(1).dragTo(page.locator('#gallery-photos .photo-card').nth(3));
      expect(await page.locator('#gallery-photos .photo-card').nth(3).getAttribute('data-photo-id')).toBe('original-1');
    }
    await page.locator('#gallery-photos .photo-preview').last().click();
    await page.locator('#use-cover').click();
    await page.locator('#gallery-photos .photo-preview').last().click();
    await page.locator('#use-featured').click();
    await page.locator('#business-name').fill('Staging test only');
    await page.locator('#roc-number').fill('001234');
    await page.locator('#verification-url').fill('https://azroc.my.site.com/AZRoc/s/contractor-search');
    await page.locator('#area-region').fill('East Valley');
    await page.locator('#area-cities').fill('Mesa\nTempe\nGilbert');
    await page.locator('#save').click();
    await check(`${name}: Save publishes photos, service area, and license`, async () => {
      await expect(page.locator('#save-status')).toContainText('Saved!');
      expect(state.saves).toBe(1);
      expect(state.content.gallery.length).toBe(12);
      expect(state.content.hero).toBe(state.content.gallery.at(-1).url);
      expect(state.content.featured).toBe(state.content.hero);
      expect(state.content.license.number).toBe('001234');
      expect(state.content.serviceArea).toEqual({ region: 'East Valley', cities: ['Mesa', 'Tempe', 'Gilbert'] });
    });
    await page.goto(baseURL);
    await check(`${name}: public page reflects the saved content`, async () => {
      await expect(page.locator('#gallery-grid > div')).toHaveCount(12);
      await expect(page.locator('#homepage-cover')).toHaveAttribute('src', state.content.hero);
      await expect(page.locator('#featured-project-photo')).toHaveAttribute('src', state.content.featured);
      await expect(page.locator('#license-number')).toHaveText('ROC 001234');
      await expect(page.locator('#license-business-name')).toHaveText('Staging test only');
      await expect(page.locator('[data-service-area-region]').first()).toHaveText('East Valley');
      await expect(page.locator('[data-service-area-cities]')).toHaveText('Mesa, Tempe, Gilbert');
      await expect(page.locator('#license-verification')).toHaveAttribute('href', 'https://azroc.my.site.com/AZRoc/s/contractor-search');
      expect(await page.locator('body').innerText()).not.toContain('ROC Verified');
      // The imported site has offscreen translated reveal animations; check the new block itself.
      expect(await page.evaluate(() => {
        const rect = document.getElementById('business-license').getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth;
      })).toBe(true);
    });
    await page.locator('#business-license').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `generated-artifacts/browser/license-${name}.png` });
    await page.goto(`${baseURL}/admin`);
    await expect(page.locator('#editor')).toBeVisible();
    await page.locator('#logout').click();
    await expect(page.locator('#login-panel')).toBeVisible();
    await expect(page.locator('#editor')).toBeHidden();
    await check(`${name}: unapproved signed-in account cannot open editor`, async () => {
      state.canEdit = false;
      await signIn(page, `${role}@example.invalid`);
      await expect(page.locator('#login-status')).toContainText('does not have edit access');
      await expect(page.locator('#editor')).toBeHidden();
    });
    state.content = { ...state.content, hero: null, featured: null, services: [null, null, null, null, null], gallery: [], license: { businessName: '', number: '', verificationUrl: '' } };
    await page.goto(baseURL);
    await check(`${name}: deleting all photos leaves no empty image areas`, async () => {
      await expect(page.locator('#services-grid > div')).toHaveCount(5);
      await expect(page.locator('#services-grid img')).toHaveCount(0);
      await expect(page.locator('#gallery')).toBeHidden();
      await expect(page.locator('#homepage-cover')).toHaveCount(0);
      await expect(page.locator('#featured-project-photo')).toHaveCount(0);
      await expect(page.locator('#business-license')).toBeHidden();
    });
    expect(failures, `${name}: no page JavaScript errors`).toEqual([]);
    await context.close();
  }
  console.log(`${checks} browser checks passed with simulated Supabase; no external emails or production writes.`);
} finally { await browser.close(); }
