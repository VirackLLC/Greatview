// Runs entirely on the owner's device. No original filenames or GPS metadata are uploaded.
export async function optimizePhoto(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  if (!allowed.includes(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    throw new Error('Choose a JPEG, PNG, WebP, or a photo from your phone.');
  }
  if (file.size > 30 * 1024 * 1024) throw new Error('This photo is too large. Choose a photo smaller than 30 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => {
      throw new Error('Your browser could not open this photo. Export it as JPEG or choose “Most Compatible” on your phone.');
    });
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 100000000) {
      throw new Error('Choose a smaller photo.');
    }
    const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo editing is not supported in this browser.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.88));
    if (!blob || blob.type !== 'image/webp') throw new Error('Please use an up-to-date Safari or Chrome to upload photos.');
    if (blob.size > 5 * 1024 * 1024) throw new Error('This photo is still too large. Please choose a smaller version.');
    return blob;
  } finally { URL.revokeObjectURL(url); }
}
