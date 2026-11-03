const MAX_VALIDATIONS_PER_WINDOW = 300;
const VALIDATION_WINDOW_MS = 10 * 60 * 1000;
const validationStore = globalThis.__songpaAIKeyValidation || (globalThis.__songpaAIKeyValidation = new Map());

const providers = {
  groq:{url:'https://api.groq.com/openai/v1/models',pattern:/^gsk_[A-Za-z0-9_-]{20,}$/},
  openai:{url:'https://api.openai.com/v1/models',pattern:/^sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}$/}
};

function send(res,status,body) {
  res.statusCode = status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(JSON.stringify(body));
}

function requestAllowed(req) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  let bucket = validationStore.get(ip);
  if (!bucket || now - bucket.startedAt >= VALIDATION_WINDOW_MS) bucket = {startedAt:now,count:0};
  bucket.count++;
  validationStore.set(ip,bucket);
  if (validationStore.size > 1000) {
    for (const [key,value] of validationStore) if (now - value.startedAt >= VALIDATION_WINDOW_MS) validationStore.delete(key);
  }
  return bucket.count <= MAX_VALIDATIONS_PER_WINDOW;
}

export default async function handler(req,res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow','GET');
    return send(res,405,{error:'GET 요청만 사용할 수 있습니다.'});
  }

  const appOrigin = process.env.APP_ORIGIN;
  const requestOrigin = req.headers.origin;
  if (appOrigin && requestOrigin && requestOrigin !== appOrigin) return send(res,403,{error:'허용되지 않은 요청입니다.'});
  if (!requestAllowed(req)) return send(res,429,{error:'키 확인 요청이 많습니다. 잠시 후 다시 시도해 주세요.'});

  const url = new URL(req.url || '/', 'http://localhost');
  const requestedProvider = req.query?.provider || url.searchParams.get('provider');
  const providerName = requestedProvider === 'groq' || requestedProvider === 'openai' ? requestedProvider : '';
  if (!providerName) return send(res,400,{error:'AI 제공자를 선택해 주세요.'});
  const envName = providerName === 'groq' ? 'GROQ_API_KEY' : 'OPENAI_API_KEY';
  const apiKey = String(process.env[envName] || '').trim();
  const provider = providers[providerName];
  if (!apiKey) return send(res,503,{error:`기관 공용 키가 서버에 설정되지 않았습니다. Vercel 환경변수 ${envName}을 설정해 주세요.`});
  if (apiKey.length > 300 || !provider.pattern.test(apiKey)) {
    return send(res,500,{error:`서버 환경변수 ${envName}의 키 형식이 올바르지 않습니다. 새 키를 발급해 다시 저장해 주세요.`});
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(),10000);
  try {
    const upstream = await fetch(provider.url,{method:'GET',headers:{'Authorization':`Bearer ${apiKey}`},signal:controller.signal,cache:'no-store'});
    if (upstream.status === 401) return send(res,401,{error:`${providerName === 'groq' ? 'Groq' : 'OpenAI'}에서 API 키를 거부했습니다. 키를 다시 확인해 주세요.`});
    if (upstream.status === 403) return send(res,403,{error:'API 키 인증은 거부되었거나 계정 권한이 부족합니다. 키와 계정 설정을 확인해 주세요.'});
    if (upstream.status === 429) return send(res,429,{error:'제공자 요청 제한으로 키를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.'});
    if (!upstream.ok) return send(res,502,{error:'제공자 인증 확인 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.'});
    const payload = await upstream.json();
    if (!Array.isArray(payload.data)) return send(res,502,{error:'제공자의 인증 응답 형식을 확인할 수 없습니다.'});
    return send(res,200,{valid:true,provider:providerName});
  } catch (error) {
    if (error?.name === 'AbortError') return send(res,504,{error:'API 키 확인 시간이 초과되었습니다. 다시 시도해 주세요.'});
    return send(res,502,{error:'제공자에 연결할 수 없습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.'});
  } finally {
    clearTimeout(timeout);
  }
}
