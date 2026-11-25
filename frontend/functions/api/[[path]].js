const HR_API = 'https://talent-acquisation-portal-for-emc-production.up.railway.app/api/v1';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'Content-Type',
};

const withCors = (headers = new Headers()) => {
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  return headers;
};

const firstValue = (form, keys) => {
  for (const key of keys) {
    const value = form.get(key);
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const normalizePhone = (value) => {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
};

const normalizeExperience = (value) => value.match(/\d+/)?.[0] ?? value;

const normalizeApplyForm = async (request) => {
  const source = await request.formData();
  const form = new FormData();
  form.set('job_id', firstValue(source, ['job_id', 'openingId', 'jobOpeningId', 'jobId']));
  form.set('job_title', firstValue(source, ['job_title', 'jobTitle', 'jobCode', 'title']));
  form.set('full_name', firstValue(source, ['full_name', 'fullName', 'name']));
  form.set('email', firstValue(source, ['email']));
  form.set('phone', normalizePhone(firstValue(source, ['phone'])));
  form.set('experience', normalizeExperience(firstValue(source, ['experience'])));
  form.set('cover_letter', firstValue(source, ['cover_letter', 'coverLetter']));
  const cv = source.get('cv') ?? source.get('resume');
  if (cv && typeof cv === 'object' && typeof cv.arrayBuffer === 'function') {
    form.set('cv', cv, cv.name || 'cv.pdf');
  }
  return new Request(request.url, { method: 'POST', body: form });
};

const safeRequestHeaders = (headers) => {
  const out = new Headers();
  headers.forEach((value, key) => {
    if (!['host', 'connection', 'content-length', 'cf-connecting-ip', 'cf-ray'].includes(key.toLowerCase())) {
      out.set(key, value);
    }
  });
  return out;
};

const safeResponseHeaders = (headers) => {
  const out = new Headers();
  for (const key of ['content-type', 'cache-control', 'location']) {
    const value = headers.get(key);
    if (value) out.set(key, value);
  }
  return withCors(out);
};

const normalizeApplyResponse = (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return response;
  const clone = response.clone();
  return response.json().then((payload) => {
    const data = payload && typeof payload === 'object'
      ? (payload.data && typeof payload.data === 'object' ? payload.data : payload)
      : null;
    const app = data && typeof data.application === 'object' && data.application ? data.application : null;
    if (data && app) {
      if (!data.reference && app.applicationCode) data.reference = app.applicationCode;
      if (!data.applicationId && (app.id || app.applicationId)) data.applicationId = app.id || app.applicationId;
    }
    return new Response(JSON.stringify(payload), {
      status: response.status,
      statusText: response.statusText,
      headers: safeResponseHeaders(response.headers),
    });
  }).catch(() => new Response(clone.body, {
    status: response.status,
    statusText: response.statusText,
    headers: safeResponseHeaders(response.headers),
  }));
};

const proxy = async (target, request, transform) => {
  const init = {
    method: request.method,
    headers: safeRequestHeaders(request.headers),
  };
  if (!['GET', 'HEAD'].includes(request.method.toUpperCase())) {
    init.body = await request.arrayBuffer();
  }
  try {
    const upstream = await fetch(target, init);
    if (transform) return transform(upstream);
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: safeResponseHeaders(upstream.headers),
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Upstream API unavailable', detail: String(error) }), {
      status: 502,
      headers: withCors(new Headers({ 'content-type': 'application/json' })),
    });
  }
};

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: withCors() });
  }
  const url = new URL(request.url);
  const parts = url.pathname.replace(/^\/api\//, '').split('/').filter(Boolean);

  if (parts[0] === 'career') {
    const rest = parts.slice(1);
    if (rest[0] === 'apply') {
      const normalized = await normalizeApplyForm(request);
      return proxy(`${HR_API}/career/applications`, normalized, normalizeApplyResponse);
    }
    return proxy(`${HR_API}/career/${rest.join('/')}${url.search}`, request);
  }

  const flask = env.FLASK_API_ORIGIN;
  if (flask) {
    return proxy(`${flask.replace(/\/$/, '')}/api/${parts.join('/')}${url.search}`, request);
  }

  if (parts[0] === 'visitor-counter') {
    return new Response(JSON.stringify({ count: 0 }), {
      headers: withCors(new Headers({ 'content-type': 'application/json' })),
    });
  }

  return new Response(JSON.stringify({
    error: 'This API route needs the Flask backend. Set FLASK_API_ORIGIN in Cloudflare Pages settings.',
  }), {
    status: 503,
    headers: withCors(new Headers({ 'content-type': 'application/json' })),
  });
}
