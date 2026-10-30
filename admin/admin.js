import { createClient } from '@supabase/supabase-js';
import { SERVICE_NAMES, initialServiceArea, validateLicense, validateServiceArea, movePhoto, removePhoto } from '../shared/content.mjs';
import { optimizePhoto } from './photos.js';

const $ = id => document.getElementById(id);
let client, user, content, savedContent, version, selected, uploadTarget, draggedId;
let busy = false, dirty = false, authGeneration = 0, recoveryMode = false;
const clone = value => JSON.parse(JSON.stringify(value));
const disabledStates = new WeakMap();

function message(id, text, error = false) {
  $(id).textContent = text;
  $(id).classList.toggle('error', error);
}
function markDirty() {
  dirty = JSON.stringify(content) !== JSON.stringify(savedContent);
  $('save-summary').textContent = dirty ? 'You have changes ready to save.' : 'Your website is up to date.';
  $('save').disabled = !dirty || busy;
  $('discard').disabled = !dirty || busy;
}
function setBusy(value) {
  busy = value;
  // Freeze editing during uploads/publish so changes cannot be overwritten by an in-flight save.
  for (const container of [$('editor'), $('photo-dialog')]) {
    container.querySelectorAll('button, input, textarea').forEach(element => {
      if (value) { disabledStates.set(element, element.disabled); element.disabled = true; }
      else if (disabledStates.has(element)) { element.disabled = disabledStates.get(element); disabledStates.delete(element); }
    });
  }
  if (content) markDirty();
  $('save').textContent = value ? 'Please wait…' : 'Save Changes';
}
function showPanel(id) {
  for (const panel of ['login-panel', 'password-recovery-panel', 'setup-panel', 'editor', 'loading-status']) $(panel).hidden = panel !== id;
}

async function start() {
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (!response.ok) { showPanel('setup-panel'); return; }
    const config = await response.json();
    recoveryMode = new URLSearchParams(location.search).get('recover') === '1' ||
      new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery';
    client = createClient(config.url, config.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    client.auth.onAuthStateChange((event, session) => {
      // Avoid invoking another auth operation synchronously inside Supabase's auth lock.
      if (event === 'SIGNED_OUT') {
        authGeneration++;
        user = content = savedContent = null; dirty = false;
        $('photo-dialog').close();
        $('main-photos').replaceChildren(); $('gallery-photos').replaceChildren(); $('featured-photos').replaceChildren();
          $('license-form').reset(); $('service-area-form').reset();
          recoveryMode = false;
        showPanel('login-panel');
      }
      if (event === 'PASSWORD_RECOVERY') {
        recoveryMode = true;
        showPanel('password-recovery-panel');
      }
      if (event === 'SIGNED_IN' && !user) setTimeout(() => { if (!recoveryMode) openEditor(session); }, 0);
    });
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (recoveryMode) showPanel('password-recovery-panel');
    else if (data.session) await openEditor(data.session);
    else showPanel('login-panel');
  } catch {
    showPanel('setup-panel');
  }
}

async function openEditor(session) {
  if (!session || user) return;
  user = session.user;
  const generation = ++authGeneration;
  try {
    const { data: allowed, error: ownerError } = await client.rpc('can_edit_site');
    if (ownerError || allowed !== true) throw new Error('This account does not have edit access.');
    const { data, error } = await client.from('site_content').select('content,version').eq('id', 1).single();
    if (error || !data) throw new Error('Your owner tools need to be connected. Please contact the person who set up your website.');
    if (generation !== authGeneration) return;
    content = { ...clone(data.content), serviceArea: data.content.serviceArea ?? initialServiceArea() };
    savedContent = clone(content); version = data.version;
    render(); renderServiceArea(); renderLicense(); markDirty();
    showPanel('editor');
  } catch (error) {
    await client.auth.signOut({ scope: 'local' });
    user = null;
    showPanel('login-panel');
    message('login-status', error.message, true);
  }
}

$('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  $('sign-in').disabled = true;
  message('login-status', 'Checking your sign-in…');
  try {
    const { error } = await client.auth.signInWithPassword({
      email: $('email').value.trim(),
      password: $('password').value
    });
    if (error) throw error;
    $('password').value = '';
    message('login-status', '');
  } catch {
    message('login-status', 'That email and password could not be verified. Check them and try again.', true);
  } finally { $('sign-in').disabled = false; }
});

$('request-password-reset').addEventListener('click', async () => {
  const email = $('email').value.trim();
  if (!email) {
    $('email').focus();
    message('login-status', 'Enter your email address first, then choose “Forgot your password?”.', true);
    return;
  }
  const button = $('request-password-reset');
  button.disabled = true;
  message('login-status', 'Requesting a password reset…');
  try {
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/admin?recover=1` });
    if (error) throw error;
    message('login-status', 'If that email has an invited account, a password-reset link will arrive shortly.');
  } catch {
    message('login-status', 'We could not request a reset right now. Please try again in a minute.', true);
  } finally { button.disabled = false; }
});

$('password-recovery-form').addEventListener('submit', async event => {
  event.preventDefault();
  const password = $('new-password').value;
  if (password !== $('confirm-password').value) {
    message('password-recovery-status', 'Those passwords do not match.', true);
    $('confirm-password').focus();
    return;
  }
  if (password.length < 12) {
    message('password-recovery-status', 'Use at least 12 characters for your new password.', true);
    $('new-password').focus();
    return;
  }
  const button = $('save-password');
  button.disabled = true;
  try {
    const { error } = await client.auth.updateUser({ password });
    if (error) throw error;
    $('password-recovery-form').reset();
    recoveryMode = false;
    history.replaceState(null, '', location.pathname);
    const { data, error: sessionError } = await client.auth.getSession();
    if (sessionError || !data.session) throw new Error('Please sign in with your new password.');
    await openEditor(data.session);
    message('editor-status', 'Your password has been updated.');
  } catch (error) {
    message('password-recovery-status', error.message === 'Please sign in with your new password.'
      ? error.message
      : 'We could not update your password. Please open a fresh reset link and try again.', true);
  } finally { button.disabled = false; }
});
$('logout').addEventListener('click', async () => {
  if (dirty && !confirm('Leave without saving your changes?')) return;
  const { error } = await client.auth.signOut();
  if (error) message('editor-status', 'Could not log out. Please try again.', true);
  else { $('login-form').reset(); message('login-status', 'You are logged out.'); }
});

function photoUrl(section, key) {
  if (section === 'gallery') return content.gallery.find(photo => photo.id === key)?.url;
  if (section === 'services') return content.services[key];
  return content[section];
}
function setPhoto(section, key, url) {
  if (section === 'gallery') content.gallery.find(photo => photo.id === key).url = url;
  else if (section === 'services') content.services[key] = url;
  else content[section] = url;
}
function button(text, action, label = text) {
  const element = document.createElement('button');
  element.type = 'button'; element.textContent = text; element.setAttribute('aria-label', label);
  element.addEventListener('click', action);
  return element;
}
function photoCard(section, key, label) {
  const url = photoUrl(section, key);
  const card = document.createElement('article');
  card.className = 'photo-card';
  const preview = button('', () => url ? openPhoto(section, key, label) : chooseUpload({ section, key }), `${url ? 'Edit' : 'Add'} ${label} photo`);
  preview.className = 'photo-preview';
  if (url) {
    const image = new Image(); image.src = url; image.alt = label; image.loading = 'lazy';
    preview.append(image);
  } else {
    preview.classList.add('empty-photo');
    preview.textContent = '+ Add Photo';
  }
  const info = document.createElement('div'); info.className = 'photo-info';
  const title = document.createElement('p'); title.className = 'photo-label'; title.textContent = label; info.append(title);
  if (url === content.hero || url === content.featured) {
    const badge = document.createElement('span'); badge.className = 'photo-badge';
    badge.textContent = [url === content.hero ? 'Cover' : '', url === content.featured ? 'Featured' : ''].filter(Boolean).join(' · ');
    info.append(badge);
  }
  const actions = document.createElement('div'); actions.className = 'photo-actions';
  actions.append(button(url ? 'Edit Photo' : 'Add Photo', () => url ? openPhoto(section, key, label) : chooseUpload({ section, key })));
  if (section === 'gallery') {
    const i = content.gallery.findIndex(photo => photo.id === key);
    const move = direction => {
      if (busy || !movePhoto(content.gallery, key, direction)) return;
      render(); markDirty(); message('editor-status', `Photo moved to position ${i + direction + 1}.`);
      document.querySelector(`[data-photo-id="${key}"] .photo-preview`)?.focus();
    };
    const earlier = button('←', () => move(-1), `Move ${label} earlier`);
    const later = button('→', () => move(1), `Move ${label} later`);
    earlier.disabled = i === 0; later.disabled = i === content.gallery.length - 1;
    actions.append(earlier, later);
    card.dataset.photoId = key;
    // Mouse drag, with large keyboard/touch move buttons for phones and assistive technology.
    card.draggable = true;
    card.addEventListener('dragstart', event => {
      if (busy) { event.preventDefault(); return; }
      draggedId = key; event.dataTransfer.setData('text/plain', key); event.dataTransfer.effectAllowed = 'move'; card.classList.add('dragging');
    });
    card.addEventListener('dragover', event => { if (!busy && draggedId) { event.preventDefault(); card.classList.add('drop-target'); } });
    card.addEventListener('dragleave', () => card.classList.remove('drop-target'));
    card.addEventListener('dragend', () => { draggedId = null; card.classList.remove('dragging'); document.querySelectorAll('.drop-target').forEach(node => node.classList.remove('drop-target')); });
    card.addEventListener('drop', event => {
      event.preventDefault();
      if (busy || !draggedId || draggedId === key) return;
      const from = content.gallery.findIndex(photo => photo.id === draggedId);
      const to = content.gallery.findIndex(photo => photo.id === key);
      if (from < 0 || to < 0) return;
      content.gallery.splice(to, 0, content.gallery.splice(from, 1)[0]);
      draggedId = null; render(); markDirty(); message('editor-status', 'Photo order updated. Save Changes to publish it.');
    });
  }
  card.append(preview, info, actions);
  return card;
}
function render() {
  $('main-photos').replaceChildren(photoCard('hero', null, 'Homepage Cover'), ...SERVICE_NAMES.map((name, i) => photoCard('services', i, name)));
  $('featured-photos').replaceChildren(photoCard('featured', null, 'Project Spotlight'));
  $('gallery-photos').replaceChildren(...content.gallery.map((photo, i) => photoCard('gallery', photo.id, `Project ${i + 1}`)));
  if (!content.gallery.length) {
    const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = 'Add your first project photo. The gallery stays hidden on your website until you add photos.';
    $('gallery-photos').append(empty);
  }
}
function renderLicense() {
  $('business-name').value = content.license.businessName;
  $('roc-number').value = content.license.number;
  $('verification-url').value = content.license.verificationUrl;
}
function renderServiceArea() {
  $('area-region').value = content.serviceArea.region;
  $('area-cities').value = content.serviceArea.cities.join('\n');
}
$('license-form').addEventListener('submit', event => event.preventDefault());
$('license-form').addEventListener('input', () => {
  content.license = {
    businessName: $('business-name').value.trim(), number: $('roc-number').value.trim(),
    verificationUrl: $('verification-url').value.trim()
  };
  markDirty();
});
$('service-area-form').addEventListener('submit', event => event.preventDefault());
$('service-area-form').addEventListener('input', () => {
  content.serviceArea = {
    region: $('area-region').value.trim(),
    cities: $('area-cities').value.split(/[\n,]/).map(city => city.trim()).filter(Boolean)
  };
  markDirty();
});
function openPhoto(section, key, label) {
  if (busy) return;
  selected = { section, key, label };
  $('photo-dialog-title').textContent = label;
  $('selected-photo').src = photoUrl(section, key);
  $('selected-photo').alt = label;
  $('use-cover').hidden = section === 'hero';
  $('use-featured').hidden = section === 'featured';
  $('photo-dialog').showModal();
}
$('close-photo-dialog').addEventListener('click', () => { if (!busy) $('photo-dialog').close(); });
$('photo-dialog').addEventListener('cancel', event => { if (busy) event.preventDefault(); });
$('replace-photo').addEventListener('click', () => chooseUpload(selected));
$('delete-photo').addEventListener('click', () => {
  if (!confirm('Remove this photo from this section? Your website changes only when you tap Save Changes.')) return;
  removePhoto(content, selected.section, selected.key);
  $('photo-dialog').close(); render(); markDirty();
  message('editor-status', 'Photo removed. Save Changes to publish.');
});
for (const [id, slot] of [['use-cover', 'hero'], ['use-featured', 'featured']]) {
  $(id).addEventListener('click', () => {
    content[slot] = photoUrl(selected.section, selected.key);
    $('photo-dialog').close(); render(); markDirty();
    message('editor-status', `${slot === 'hero' ? 'Homepage cover' : 'Featured project'} selected. Save Changes to publish.`);
  });
}
function chooseUpload(target) {
  if (busy) return;
  uploadTarget = target;
  $('photo-upload').multiple = target.section === 'add-gallery';
  $('photo-upload').value = '';
  $('photo-upload').click();
}
$('add-gallery').addEventListener('click', () => chooseUpload({ section: 'add-gallery' }));
$('photo-upload').addEventListener('change', async () => {
  if (!$('photo-upload').files.length) return;
  const target = { ...uploadTarget };
  const files = [...$('photo-upload').files];
  setBusy(true);
  let uploaded = 0;
  try {
    for (const file of files) {
      if (target.section === 'add-gallery' && content.gallery.length >= 80) throw new Error('Your gallery can hold up to 80 photos.');
      message('editor-status', `Preparing photo ${uploaded + 1} of ${files.length}…`);
      const blob = await optimizePhoto(file);
      if (!user || !content) throw new Error('Please sign in again before uploading.');
      const filePath = `${user.id}/${crypto.randomUUID()}.webp`;
      const { error } = await client.storage.from('site-photos').upload(filePath, blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
      if (error) throw new Error('Could not upload this photo. Check your connection and try again.');
      if (!content) throw new Error('Please sign in again.');
      const { data } = client.storage.from('site-photos').getPublicUrl(filePath);
      if (target.section === 'add-gallery') {
        content.gallery.push({ id: crypto.randomUUID(), url: data.publicUrl, title: 'Greatview Hardscape project' });
      } else setPhoto(target.section, target.key, data.publicUrl);
      uploaded++;
    }
    message('editor-status', `${uploaded === 1 ? 'Photo ready' : `${uploaded} photos ready`}. Tap Save Changes to show ${uploaded === 1 ? 'it' : 'them'} on your website.`);
  } catch (error) {
    message('editor-status', `${uploaded ? `${uploaded} photo(s) ready to save. ` : ''}${error.message}`, true);
  } finally {
    $('photo-dialog').close();
    if (content) { render(); markDirty(); }
    setBusy(false);
  }
});
$('discard').addEventListener('click', () => {
  if (!confirm('Discard all unsaved photo, service-area, and license changes?')) return;
  content = clone(savedContent); render(); renderServiceArea(); renderLicense(); markDirty(); message('editor-status', 'Unsaved changes discarded.');
});
$('save').addEventListener('click', async () => {
  if (!dirty || busy) return;
  const serviceAreaError = validateServiceArea(content.serviceArea);
  if (serviceAreaError) { message('save-status', serviceAreaError, true); return; }
  const error = validateLicense(content.license);
  if (error) { message('save-status', error, true); return; }
  setBusy(true); message('save-status', 'Saving your changes…');
  const snapshot = clone(content);
  try {
    const { data, error: publishError } = await client.rpc('publish_site', { new_content: snapshot, expected_version: version });
    if (publishError) {
      if (publishError.code === '40001') throw new Error('Changes were saved in another tab. Copy any license details you need, then reload this page before editing again.');
      throw new Error('Your changes could not be saved. Check your connection and owner access, then try again.');
    }
    if (!content) return;
    version = data; savedContent = snapshot; markDirty();
    message('save-status', 'Saved! Your changes are now live on your website.');
  } catch (error) { message('save-status', error.message, true); }
  finally { setBusy(false); }
});
window.addEventListener('beforeunload', event => {
  if (!dirty && !busy) return;
  event.preventDefault(); event.returnValue = '';
});
start();
