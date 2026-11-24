const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const files=fs.readdirSync(__dirname).filter(x=>x.endsWith('.test.js')).map(x=>path.join(__dirname,x));
const r=spawnSync(process.execPath,['--test','--test-reporter=tap',...files],{encoding:'utf8'});
const output=(r.stdout||'')+'\n'+(r.stderr||'');
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/testes.html',`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Testes PIM IV</title><style>body{font:16px system-ui;max-width:1000px;margin:40px auto;padding:20px}pre{white-space:pre-wrap;background:#eee;padding:20px}</style><h1>Relatório de testes PIM IV</h1><p>${new Date().toISOString()} — ${r.status===0?'Aprovado':'Falha ou execução incompleta'}</p><p>Testes unitários e integração com banco simulado. Não valida Azure SQL real nem interfaces.</p><pre>${esc(output)}</pre></html>`);console.log(output);console.log('Relatorio: reports/testes.html');process.exitCode=r.status??1;
