import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import holidaysHandler from './api/holidays.js';
import recommendationsHandler from './api/recommendations.js';
import validateKeyHandler from './api/validate-key.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const host = '127.0.0.1';
const port = Number(process.env.PORT) || 4173;
const staticFiles = new Map([
  ['/','index.html'],
  ['/index.html','index.html'],
  ['/styles.css','styles.css'],
  ['/app.js','app.js']
]);
const apiHandlers = new Map([
  ['/api/holidays',holidaysHandler],
  ['/api/recommendations',recommendationsHandler],
  ['/api/validate-key',validateKeyHandler]
]);
const mimeTypes = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};

function send(res,status,body,contentType='text/plain; charset=utf-8') {
  res.writeHead(status,{'Content-Type':contentType,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(body);
}

async function readJsonBody(req,maxBytes=16384) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error('요청이 너무 큽니다.'),{status:413});
    chunks.push(chunk);
  }
  if (!size) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('JSON 요청 형식이 올바르지 않습니다.'),{status:400}); }
}

async function handleApi(req,res,url,handler) {
  try {
    req.query = Object.fromEntries(url.searchParams.entries());
    req.body = req.method === 'POST' ? await readJsonBody(req) : {};
    await handler(req,res);
    if (!res.writableEnded) send(res,500,'서버 함수가 응답을 완료하지 못했습니다.');
  } catch (error) {
    if (res.writableEnded) return;
    const status = Number(error?.status) || 500;
    send(res,status,JSON.stringify({error:status === 500 ? '로컬 서버 요청을 처리하지 못했습니다.' : error.message}),'application/json; charset=utf-8');
  }
}

const server = http.createServer(async (req,res) => {
  const url = new URL(req.url || '/',`http://${host}:${port}`);
  const handler = apiHandlers.get(url.pathname);
  if (handler) return handleApi(req,res,url,handler);

  const fileName = staticFiles.get(url.pathname);
  if (!fileName) return send(res,404,'페이지를 찾을 수 없습니다.');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow','GET, HEAD');
    return send(res,405,'지원하지 않는 요청입니다.');
  }
  try {
    const content = await readFile(path.join(root,fileName));
    res.writeHead(200,{'Content-Type':mimeTypes[path.extname(fileName)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch {
    send(res,500,'페이지 파일을 읽지 못했습니다.');
  }
});

server.on('error',(error) => {
  if (error?.code === 'EADDRINUSE') console.error(`포트 ${port}를 이미 사용 중입니다. PORT 환경변수를 바꿔 다시 실행해 주세요.`);
  else console.error('로컬 웹 서버를 시작하지 못했습니다.');
  process.exitCode = 1;
});

server.listen(port,host,() => {
  console.log(`송파복지관 업무 도구: http://${host}:${port}`);
  console.log('이 창을 열어 둔 채 브라우저에서 위 주소를 여세요. 종료하려면 Ctrl+C를 누르세요.');
});
