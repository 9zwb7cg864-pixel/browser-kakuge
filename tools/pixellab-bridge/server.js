// PixelLab とやり取りする小さな MCP サーバー（依存なし・Node 18 以上）
// 使い方: node server.js --secret=pixl_xxx
// ツール pl_request: PixelLab の API に JSON を送り、返事を out_dir に保存（画像は PNG に書き出す）
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const arg = process.argv.find(a => a.startsWith('--secret='));
const SECRET = arg ? arg.slice(9) : (process.env.PIXELLAB_SECRET || '');
const BASE = { v1: 'https://api.pixellab.ai/v1', v2: 'https://api.pixellab.ai/v2' };

function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
function ok(id, result) { send({ jsonrpc: '2.0', id, result }); }
function err(id, code, message) { send({ jsonrpc: '2.0', id, error: { code, message } }); }

const TOOLS = [{
  name: 'pl_request',
  description: 'PixelLab の API に POST/GET する。body は body_file（このPC上のJSONファイルのパス）か body_json（文字列）で渡す。返事は out_dir/response.json に保存し、返事の中の画像（base64）は out_dir/img_N.png に書き出す。返事の要約（画像以外）を返す。',
  inputSchema: {
    type: 'object',
    properties: {
      endpoint: { type: 'string', description: '例: generate-image-pixflux, animate-with-skeleton, balance' },
      version: { type: 'string', enum: ['v1', 'v2'], default: 'v1' },
      method: { type: 'string', enum: ['POST', 'GET'], default: 'POST' },
      body_file: { type: 'string' },
      body_json: { type: 'string' },
      out_dir: { type: 'string', description: '返事と画像を保存するフォルダ（このPC上）' }
    },
    required: ['endpoint', 'out_dir']
  }
}];

function stripImages(o, out, acc) {
  if (Array.isArray(o)) return o.map(v => stripImages(v, out, acc));
  if (o && typeof o === 'object') {
    if (typeof o.base64 === 'string' && o.base64.length > 100) {
      const fn = path.join(out, `img_${acc.n++}.png`);
      fs.writeFileSync(fn, Buffer.from(o.base64, 'base64'));
      return `<画像 ${fn}>`;
    }
    const r = {};
    for (const k of Object.keys(o)) r[k] = stripImages(o[k], out, acc);
    return r;
  }
  if (typeof o === 'string' && o.length > 2000) return `<長い文字列 ${o.length}字>`;
  return o;
}

async function call(args) {
  const out = args.out_dir;
  fs.mkdirSync(out, { recursive: true });
  let body = null;
  if (args.body_file) body = fs.readFileSync(args.body_file, 'utf8');
  else if (args.body_json) body = args.body_json;
  const url = `${BASE[args.version || 'v1']}/${args.endpoint}`;
  const res = await fetch(url, {
    method: args.method || 'POST',
    headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: (args.method || 'POST') === 'POST' ? body : undefined
  });
  const text = await res.text();
  fs.writeFileSync(path.join(out, 'response.json'), text);
  let summary;
  try { summary = stripImages(JSON.parse(text), out, { n: 0 }); }
  catch { summary = text.slice(0, 2000); }
  return `HTTP ${res.status}\n` + JSON.stringify(summary, null, 1).slice(0, 6000);
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async line => {
  let m; try { m = JSON.parse(line); } catch { return; }
  const { id, method, params } = m;
  if (method === 'initialize') return ok(id, { protocolVersion: (params && params.protocolVersion) || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'pixellab-bridge', version: '1.0.0' } });
  if (method === 'ping') return ok(id, {});
  if (method === 'tools/list') return ok(id, { tools: TOOLS });
  if (method === 'tools/call') {
    try {
      const text = await call(params.arguments || {});
      return ok(id, { content: [{ type: 'text', text }] });
    } catch (e) {
      return ok(id, { content: [{ type: 'text', text: 'エラー: ' + (e && e.message) }], isError: true });
    }
  }
  if (id !== undefined) err(id, -32601, 'method not found');
});
