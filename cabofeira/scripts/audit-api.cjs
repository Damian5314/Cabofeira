// Local synthetic API for frontend audit ONLY. No real Supabase connection.
// Run: node scripts/audit-api.cjs. All mutations disappear on restart.
const http = require('http');
const fs = require('fs');
const path = require('path');
const userId = '00000000-0000-4000-8000-000000000001';
const sellerId = '00000000-0000-4000-8000-000000000002';
const users = [
  { id: userId, name: 'Conta de teste', email: 'buyer@example.test', phone: '', role: 'user', verified: false, member_since: '2026-01-01' },
  { id: sellerId, name: 'Vendedor de teste', email: 'seller@example.test', phone: '+238 9912345', role: 'user', verified: true, member_since: '2025-01-01' },
];
const products = Array.from({length:28},(_,i)=>({
  id:`10000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,seller_id:i<25?userId:sellerId,
  title:i===27?'Bicicleta para passeios em Santiago':`Anúncio de teste ${i+1}`,description:'Artigo de demonstração para testar a interface sem alterar dados reais.',
  price:1500+i*100,currency:'CVE',category:'vehicles',subcategory:'Bicycles',condition:'Used',location_city:'Praia',location_island:'Santiago',
  images:[],featured:false,views:4,status:i===0?'sold':'active',created_at:new Date(Date.UTC(2026,8,1,0,i)).toISOString(),
}));
const tables={profiles:users,products,favorites:[],conversations:[],messages:[],blocked_users:[],notifications:[],reports:[],app_settings:[],admin_audit_log:[]};
const authUser={id:userId,aud:'authenticated',role:'authenticated',email:users[0].email,user_metadata:{name:users[0].name},app_metadata:{provider:'email'},created_at:'2026-01-01T00:00:00Z'};
function session(){const now=Math.floor(Date.now()/1000);const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');return {access_token:`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:userId,role:'authenticated',aud:'authenticated',iat:now,exp:now+3600})}.test`,refresh_token:'local-fixture-only',token_type:'bearer',expires_in:3600,expires_at:now+3600,user:authUser};}
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:4180');
 res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:4174');
 res.setHeader('Access-Control-Allow-Headers',req.headers['access-control-request-headers'] || 'authorization,apikey,content-type,prefer,x-client-info,range,range-unit');
 res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,HEAD,OPTIONS');
 res.setHeader('Access-Control-Expose-Headers','Content-Range');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 const send=(status,data)=>{console.log(`${req.method} ${url.pathname} ${status}`);res.writeHead(status,{'Content-Type':'application/json'});res.end(req.method==='HEAD'?undefined:JSON.stringify(data));};
 let raw='';for await(const chunk of req)raw+=chunk;
 let body={};try{if(raw)body=JSON.parse(raw);}catch{return send(400,{message:'Invalid JSON'});}
 if(url.pathname==='/auth/v1/token')return body.email===users[0].email&&body.password==='LocalAudit2026!'?send(200,session()):send(400,{error:'invalid_grant',error_description:'Invalid login credentials'});
 if(url.pathname==='/auth/v1/user')return send(200,authUser);
 if(url.pathname==='/auth/v1/logout')return send(204,null);
 if(url.pathname.startsWith('/rest/v1/rpc/'))return send(200,null);
 if(url.pathname.startsWith('/rest/v1/')){
  const table=url.pathname.split('/').pop();if(!tables[table])return send(404,{message:'Fixture route unavailable'});
  if(url.searchParams.get('or')?.includes('audit-error'))return send(503,{message:'Simulated API unavailable'});
  if(url.searchParams.get('or')?.includes('audit-slow'))await new Promise(r=>setTimeout(r,2000));
  let rows=tables[table].filter(row=>[...url.searchParams].every(([key,value])=>{
   if(value.startsWith('eq.'))return String(row[key])===value.slice(3);
   if(value.startsWith('neq.'))return String(row[key])!==value.slice(4);
   if(value.startsWith('in.'))return value.slice(3).replace(/[()"']/g,'').split(',').includes(String(row[key]));
   if(value.startsWith('gte.'))return row[key]>=Number(value.slice(4));
   if(value.startsWith('lte.'))return row[key]<=Number(value.slice(4));
   return true;
  }));
  if(req.method==='POST'){const row={id:require('crypto').randomUUID(),created_at:new Date().toISOString(),status:'active',views:0,featured:false,...body};tables[table].push(row);rows=[row];}
  if(req.method==='PATCH')rows.forEach(row=>Object.assign(row,body));
  if(req.method==='DELETE'){tables[table]=tables[table].filter(row=>!rows.includes(row));return send(204,null);}
  if(table==='products')rows=rows.map(row=>({...row,seller:users.find(u=>u.id===row.seller_id)}));
  const total=rows.length;const offset=Number(url.searchParams.get('offset')||0);const limit=Number(url.searchParams.get('limit')||1000);rows=rows.slice(offset,offset+limit);
  res.setHeader('Content-Range',`${offset}-${Math.max(offset,offset+rows.length-1)}/${total}`);
  return send(200,req.headers.accept?.includes('vnd.pgrst.object')?(rows[0]||null):rows);
 }
 return send(404,{message:'No local fixture for endpoint'});
}).listen(4180,'127.0.0.1',()=>console.log('Synthetic API at 127.0.0.1:4180; no production connection'));

const root=path.resolve(__dirname,'../build-audit');
http.createServer((req,res)=>{
 if(req.url==='/audit-axe.js'){res.setHeader('Content-Type','text/javascript');return fs.createReadStream(require.resolve('axe-core/axe.min.js')).pipe(res);}
 if(req.url==='/audit-accessibility.js'){
   res.setHeader('Content-Type','text/javascript');
   return res.end(`setTimeout(async () => { const results = await axe.run(document, {runOnly: {type:'tag', values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}); const output=document.createElement('pre'); output.id='audit-accessibility-results'; output.hidden=true; output.textContent=JSON.stringify({violations:results.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:results.incomplete.map(v=>v.id),passes:results.passes.length}); document.body.append(output); }, 1500);`);
 }
 const target=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 const file=fs.existsSync(target)&&fs.statSync(target).isFile()?target:path.join(root,'index.html');
 if(file===path.join(root,'index.html')&&new URL(req.url,'http://localhost').searchParams.has('audit-a11y')){res.setHeader('Content-Type','text/html');return res.end(fs.readFileSync(file,'utf8').replace('</body>','<script src="/audit-axe.js"></script><script src="/audit-accessibility.js"></script></body>'));}
 const types={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.html':'text/html','.json':'application/json','.png':'image/png','.ico':'image/x-icon'};
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
 fs.createReadStream(file).on('error',()=>{res.statusCode=404;res.end();}).pipe(res);
}).listen(4174,'127.0.0.1',()=>console.log('Audit frontend at http://127.0.0.1:4174'));
