// Storage abstraction: Supabase Storage in prod, local disk in dev fallback.
// Files accepted: image/* or application/pdf, <=5MB each (validated in route).
const fs = require('fs');
const path = require('path');

async function supabase() {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

async function uploadDoc({ buffer, filename, mime, key }) {
  const bucket = process.env.STORAGE_BUCKET || 'lg-docs';
  try {
    const sb = await supabase();
    const { error } = await sb.storage.from(bucket).upload(key, buffer, { contentType: mime, upsert: true });
    if (error) throw error;
    // Signed URL works for private buckets (1yr); public buckets fine too.
    const { data, error: signErr } = await sb.storage.from(bucket).createSignedUrl(key, 31536000);
    if (!signErr && data?.signedUrl) return data.signedUrl;
    const { data: pub } = sb.storage.from(bucket).getPublicUrl(key);
    return pub.publicUrl;
  } catch (e) {
    // Local fallback (dev without bucket)
    const dir = path.join(process.cwd(), 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    const fp = path.join(dir, path.basename(key));
    fs.writeFileSync(fp, buffer);
    return `/uploads/${path.basename(key)}`;
  }
}

module.exports = { uploadDoc };
