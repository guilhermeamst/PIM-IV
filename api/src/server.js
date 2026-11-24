require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { sql, getPool } = require('./db');
const { auth, adminOnly } = require('./middleware');
const { awardLessonCompletion } = require('./gamificationService');


const crypto = require('crypto');
const { hashPassword, verifyPassword, validateAccount, newRecoveryCode, codeDigest, normalizeCode } = require('./accountSecurity');
async function createAccount(body, publicSignup, res) {
  const data = validateAccount(body, publicSignup);
  if (data.error) {
    console.warn('[VALIDACAO CADASTRO]', data.error);
    return res.status(400).json({ message: data.error });
  }
  try {
    const pool = await getPool();
    const senhaHash = await hashPassword(data.senha);
    const recoveryCode = newRecoveryCode();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    let id;
    try {
      const result = await new sql.Request(tx)
        .input('nome', sql.NVarChar(200), data.nome)
        .input('email', sql.NVarChar(200), data.email)
        .input('senha', sql.NVarChar(200), senhaHash)
        .input('perfil', sql.NVarChar(20), data.perfil)
        .query(`INSERT INTO dbo.Usuarios (Nome, Email, Senha, Perfil, Ativo, DataCadastro)
                OUTPUT INSERTED.Id VALUES (@nome, @email, @senha, @perfil, 1, GETDATE())`);
      id = result.recordset[0].Id;
      await new sql.Request(tx).input('id', sql.Int, id)
        .input('digest', sql.Char(64), codeDigest(recoveryCode))
        .query(`INSERT INTO dbo.CodigosRecuperacao (UsuarioId, CodigoHash)
                VALUES (@id, @digest)`);
      await tx.commit();
    } catch (e) { await tx.rollback(); throw e; }
    return res.status(201).json({ id, message: 'Usuario criado com sucesso.', codigoRecuperacao: recoveryCode });
  } catch (error) {
    console.error('[ERRO CADASTRO]', error.message);
    if (error.number === 2627 || error.number === 2601 || /duplicate|unique|duplicad/i.test(error.message))
      return res.status(409).json({ message: 'Este email ja esta cadastrado.' });
    return res.status(500).json({ message: 'Erro ao criar usuario.' });
  }
}

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SECRET = require('./jwtSecret');

function tokenFor(user) {
  return jwt.sign({ id: user.Id, nome: user.Nome, email: user.Email, perfil: user.Perfil }, SECRET, { expiresIn: '8h' });
}

app.get('/api/health', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 AS ok');

    res.json({ api: 'ok', database: 'ok' });
  } catch (e) {
    console.error('[HEALTH]', e.message);

    res.status(500).json({
      api: 'ok',
      database: 'error'
    });
  }
});

// Cadastro publico de aluno com codigo pessoal de recuperacao.
app.post('/api/auth/register', (req, res) => createAccount(req.body, true, res));
app.post('/api/auth/login', async (req, res) => {
  const { email, senha } = req.body || {};
  if (typeof email !== 'string' || typeof senha !== 'string' || !email.trim() || !senha)
    return res.status(400).json({ message: 'Informe email e senha.' });
  try {
    const pool = await getPool();
    const result = await pool.request().input('email', sql.NVarChar(200), email.trim().toLowerCase())
      .query('SELECT TOP 1 Id, Nome, Email, Senha, Perfil, Ativo FROM dbo.Usuarios WHERE Email=@email');
    const user = result.recordset[0];
    if (!user || !(await verifyPassword(senha, user.Senha)))
      return res.status(401).json({ message: 'Email ou senha incorretos.' });
    if (!user.Ativo) return res.status(403).json({ message: 'Usuario inativo.' });
    if (!user.Senha.startsWith('scrypt:')) {
      await pool.request().input('id',sql.Int,user.Id).input('old',sql.NVarChar(200),user.Senha).input('senha',sql.NVarChar(200),await hashPassword(senha)).query('UPDATE dbo.Usuarios SET Senha=@senha WHERE Id=@id AND Senha=@old');
    }
    return res.json({ token: tokenFor(user), user: { id: user.Id, nome: user.Nome, email: user.Email, perfil: user.Perfil } });
  } catch (e) { return res.status(500).json({ message: 'Erro ao autenticar.' }); }
});

// Recuperacao por codigo pessoal. A consulta e a alteracao ocorrem na mesma transacao.
app.post('/api/auth/recover', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const codigo = normalizeCode(req.body?.codigoRecuperacao);
  const novaSenha = req.body?.novaSenha;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[A-Z2-9]{16}$/.test(codigo) ||
      typeof novaSenha !== 'string' || novaSenha.length < 8 || novaSenha.length > 128)
    return res.status(400).json({ message: 'Informe email, codigo de 16 caracteres e nova senha de 8 a 128 caracteres.' });
  let tx;
  try {
    const pool = await getPool();
    tx = new sql.Transaction(pool);
    await tx.begin();
    const r = await new sql.Request(tx).input('email', sql.NVarChar(200), email)
      .query(`SELECT TOP 1 u.Id, u.Ativo, r.CodigoHash, r.Tentativas,
                     r.BloqueadoAte
              FROM dbo.Usuarios u WITH (UPDLOCK, HOLDLOCK)
              LEFT JOIN dbo.CodigosRecuperacao r WITH (UPDLOCK, HOLDLOCK) ON r.UsuarioId=u.Id
              WHERE u.Email=@email`);
    const user = r.recordset[0];
    const invalid = { message: 'Nao foi possivel recuperar a conta. Confira o email e o codigo.' };
    if (!user || !user.Ativo || !user.CodigoHash) {
      await tx.commit(); return res.status(400).json(invalid);
    }
    if (user.BloqueadoAte && new Date(user.BloqueadoAte).getTime() > Date.now()) {
      await tx.commit(); return res.status(429).json({ message: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' });
    }
    const supplied = Buffer.from(codeDigest(codigo), 'hex');
    const stored = Buffer.from(user.CodigoHash, 'hex');
    if (!crypto.timingSafeEqual(supplied, stored)) {
      await new sql.Request(tx).input('id', sql.Int, user.Id).query(`
        UPDATE dbo.CodigosRecuperacao SET
          Tentativas=CASE WHEN BloqueadoAte IS NOT NULL AND BloqueadoAte <= SYSUTCDATETIME() THEN 1 ELSE Tentativas+1 END,
          BloqueadoAte=CASE WHEN (CASE WHEN BloqueadoAte IS NOT NULL AND BloqueadoAte <= SYSUTCDATETIME() THEN 1 ELSE Tentativas+1 END) >= 5
            THEN DATEADD(MINUTE, 15, SYSUTCDATETIME()) ELSE NULL END
        WHERE UsuarioId=@id`);
      await tx.commit(); return res.status(400).json(invalid);
    }
    const nextCode = newRecoveryCode();
    const senhaHash = await hashPassword(novaSenha);
    await new sql.Request(tx).input('id', sql.Int, user.Id)
      .input('senha', sql.NVarChar(200), senhaHash)
      .query('UPDATE dbo.Usuarios SET Senha=@senha WHERE Id=@id');
    await new sql.Request(tx).input('id', sql.Int, user.Id)
      .input('digest', sql.Char(64), codeDigest(nextCode))
      .query(`UPDATE dbo.CodigosRecuperacao SET CodigoHash=@digest, Tentativas=0,
              BloqueadoAte=NULL WHERE UsuarioId=@id`);
    await tx.commit();
    return res.json({ message: 'Senha redefinida com sucesso.', codigoRecuperacao: nextCode });
  } catch (e) {
    if (tx) { try { await tx.rollback(); } catch {} }
    return res.status(500).json({ message: 'Erro ao recuperar senha. Verifique a migracao SQL.' });
  }
});

// Cursos e matriculas: implementacao unica no roteador dedicado.
app.use('/api/cursos', require('./routes/courseRoutes'));

// ---------------- ADMIN: CURSOS ----------------
app.get('/api/admin/cursos', auth, adminOnly, async (req, res) => {
  const termo = (req.query.busca || '').trim();
  try {
    const pool = await getPool();
    const result = await pool.request().input('termo', sql.NVarChar(200), termo).query(`SELECT c.Id AS id,c.Titulo AS titulo,c.Descricao AS descricao,c.CargaHoraria AS cargaHoraria,c.Ativo AS ativo,(SELECT COUNT(*) FROM dbo.Aulas a WHERE a.CursoId=c.Id) AS totalAulas FROM dbo.Cursos c WHERE @termo='' OR c.Titulo LIKE '%'+@termo+'%' OR c.Descricao LIKE '%'+@termo+'%' ORDER BY c.Titulo`);
    res.json(result.recordset);
  } catch (e) { res.status(500).json({ message: 'Erro ao listar cursos.' }); }
});

app.post('/api/admin/cursos', auth, adminOnly, async (req, res) => {
  const { titulo, descricao, cargaHoraria, ativo = true } = req.body;
  if (!titulo) return res.status(400).json({ message: 'Titulo obrigatorio.' });
  try {
    const pool = await getPool();
    const r = await pool.request().input('titulo',sql.NVarChar(200),titulo).input('descricao',sql.NVarChar(sql.MAX),descricao||'').input('carga',sql.Int,Number(cargaHoraria)||0).input('ativo',sql.Bit,Boolean(ativo)).query(`INSERT INTO dbo.Cursos(Titulo,Descricao,CargaHoraria,Ativo,DataCadastro) OUTPUT INSERTED.Id VALUES(@titulo,@descricao,@carga,@ativo,GETDATE())`);
    res.status(201).json({ id:r.recordset[0].Id, message:'Curso criado.' });
  } catch(e){ res.status(500).json({message:'Erro ao criar curso.'}); }
});

app.put('/api/admin/cursos/:id', auth, adminOnly, async (req,res)=>{
  const {titulo,descricao,cargaHoraria,ativo=true}=req.body;
  try{ const pool=await getPool(); const r=await pool.request().input('id',sql.Int,Number(req.params.id)).input('titulo',sql.NVarChar(200),titulo).input('descricao',sql.NVarChar(sql.MAX),descricao||'').input('carga',sql.Int,Number(cargaHoraria)||0).input('ativo',sql.Bit,Boolean(ativo)).query('UPDATE dbo.Cursos SET Titulo=@titulo,Descricao=@descricao,CargaHoraria=@carga,Ativo=@ativo WHERE Id=@id'); if(!r.rowsAffected[0])return res.status(404).json({message:'Curso nao encontrado.'}); res.json({message:'Curso atualizado.'}); }catch(e){res.status(500).json({message:'Erro ao atualizar curso.'});}
});

app.delete('/api/admin/cursos/:id', auth, adminOnly, async (req,res)=>{
  try{const pool=await getPool();const id=Number(req.params.id);const tx=new sql.Transaction(pool);await tx.begin();try{await new sql.Request(tx).input('id',sql.Int,id).query('DELETE p FROM dbo.Progresso p INNER JOIN dbo.Aulas a ON a.Id=p.AulaId WHERE a.CursoId=@id');await new sql.Request(tx).input('id',sql.Int,id).query('DELETE FROM dbo.Aulas WHERE CursoId=@id');const r=await new sql.Request(tx).input('id',sql.Int,id).query('DELETE FROM dbo.Cursos WHERE Id=@id');await tx.commit();if(!r.rowsAffected[0])return res.status(404).json({message:'Curso nao encontrado.'});res.json({message:'Curso excluido.'});}catch(e){await tx.rollback();throw e;}}catch(e){res.status(500).json({message:'Erro ao excluir curso.'});}
});

// ---------------- ADMIN: AULAS ----------------
app.post('/api/admin/cursos/:cursoId/aulas', auth, adminOnly, async (req,res)=>{
  const cursoId=Number(req.params.cursoId); const {titulo,duracaoMin}=req.body;
  if(!titulo)return res.status(400).json({message:'Titulo obrigatorio.'});
  try{const pool=await getPool();const r=await pool.request().input('cursoId',sql.Int,cursoId).input('titulo',sql.NVarChar(300),titulo).input('duracao',sql.Int,Number(duracaoMin)||0).query(`DECLARE @ordem INT=(SELECT ISNULL(MAX(Ordem),0)+1 FROM dbo.Aulas WHERE CursoId=@cursoId); INSERT INTO dbo.Aulas(CursoId,Titulo,Ordem,DuracaoMin) OUTPUT INSERTED.Id VALUES(@cursoId,@titulo,@ordem,@duracao)`);res.status(201).json({id:r.recordset[0].Id,message:'Aula criada.'});}catch(e){res.status(500).json({message:'Erro ao criar aula.'});}
});

app.delete('/api/admin/aulas/:id', auth, adminOnly, async (req,res)=>{try{const pool=await getPool();const r=await pool.request().input('id',sql.Int,Number(req.params.id)).query('DELETE FROM dbo.Aulas WHERE Id=@id');if(!r.rowsAffected[0])return res.status(404).json({message:'Aula nao encontrada.'});res.json({message:'Aula excluida.'});}catch(e){res.status(500).json({message:'Erro ao excluir aula.'});}});

app.use('/api/professor', require('./routes/professorRoutes'));
app.use('/api/gamificacao', require('./routes/gamificationRoutes'));

// ---------------- ADMIN: USUARIOS ----------------
app.post('/api/admin/usuarios', auth, adminOnly, (req, res) => createAccount(req.body, false, res));

app.get('/api/admin/usuarios', auth, adminOnly, async (req,res)=>{const termo=(req.query.busca||'').trim();try{const pool=await getPool();const r=await pool.request().input('termo',sql.NVarChar(200),termo).query(`SELECT Id AS id,Nome AS nome,Email AS email,Perfil AS perfil,Ativo AS ativo FROM dbo.Usuarios WHERE @termo='' OR Nome LIKE '%'+@termo+'%' OR Email LIKE '%'+@termo+'%' ORDER BY Nome`);res.json(r.recordset);}catch(e){res.status(500).json({message:'Erro ao listar usuarios.'});}});

app.put('/api/admin/usuarios/:id/status', auth, adminOnly, async (req,res)=>{
  const id=Number(req.params.id), ativo=req.body?.ativo;
  if(!Number.isSafeInteger(id)||id<=0||typeof ativo!=='boolean')return res.status(400).json({message:'Dados invalidos.'});
  if(id===req.user.id&&!ativo)return res.status(400).json({message:'Nao pode desativar a propria conta.'});
  try {const pool=await getPool();const r=await pool.request().input('id',sql.Int,id).input('ativo',sql.Bit,ativo).query('UPDATE dbo.Usuarios SET Ativo=@ativo WHERE Id=@id');
  return r.rowsAffected[0]?res.json({message:'Status atualizado.'}):res.status(404).json({message:'Usuario nao encontrado.'});}catch(e){return res.status(500).json({message:'Erro ao atualizar usuario.'});}
});


// Rotas migradas da API .NET para o backend Node central.
const validId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const staffOnly = (req,res,next) => ['ADMIN','PROFESSOR'].includes(req.user?.perfil) ? next() : res.status(403).json({message:'Acesso permitido apenas a professores e administradores.'});

app.get('/api/admin/usuarios/:id', auth, adminOnly, async (req,res) => {
  const id=validId(req.params.id); if(!id)return res.status(400).json({message:'ID invalido.'});
  try { const pool=await getPool(); const r=await pool.request().input('id',sql.Int,id).query('SELECT Id AS id, Nome AS nome, Email AS email, Perfil AS perfil, Ativo AS ativo FROM dbo.Usuarios WHERE Id=@id');
    return r.recordset.length?res.json(r.recordset[0]):res.status(404).json({message:'Usuario nao encontrado.'});
  }catch(e){return res.status(500).json({message:'Erro ao carregar usuario.'});}
});
app.put('/api/admin/usuarios/:id', auth, adminOnly, async (req,res) => {
  const id=validId(req.params.id); if(!id)return res.status(400).json({message:'ID invalido.'});
  const {nome,email,ativo=true,senha=''}=req.body||{};
  const perfil=String(req.body?.perfil||'').toUpperCase();
  if(typeof ativo!=='boolean'||(id===req.user.id&&(perfil!=='ADMIN'||!ativo)))return res.status(400).json({message:'Nao pode remover o proprio acesso administrativo.'});
  if(typeof nome!=='string'||nome.trim().length<3||typeof email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['ALUNO','PROFESSOR','ADMIN'].includes(String(perfil).toUpperCase())|| (senha && (typeof senha!=='string'||senha.length<8)))return res.status(400).json({message:'Dados de usuario invalidos.'});
  try { const pool=await getPool(); const old=await pool.request().input('id',sql.Int,id).query('SELECT Perfil, Ativo FROM dbo.Usuarios WHERE Id=@id');
    if(!old.recordset.length)return res.status(404).json({message:'Usuario nao encontrado.'});
    if(old.recordset[0].Perfil==='ADMIN' && old.recordset[0].Ativo && (perfil!=='ADMIN'||!ativo)) {
      const admins=await pool.request().query("SELECT COUNT(*) AS total FROM dbo.Usuarios WHERE Perfil='ADMIN' AND Ativo=1");
      if(admins.recordset[0].total<=1)return res.status(400).json({message:'Nao e permitido remover o ultimo administrador ativo.'});
    }
    const q=pool.request().input('id',sql.Int,id).input('nome',sql.NVarChar(200),nome.trim()).input('email',sql.NVarChar(200),email.trim().toLowerCase()).input('perfil',sql.NVarChar(20),perfil).input('ativo',sql.Bit,Boolean(ativo));
    let query='UPDATE dbo.Usuarios SET Nome=@nome,Email=@email,Perfil=@perfil,Ativo=@ativo';
    if(senha){q.input('senha',sql.NVarChar(200),await hashPassword(senha));query+=',Senha=@senha';}
    await q.query(query+' WHERE Id=@id');return res.json({message:'Usuario atualizado.'});
  }catch(e){return res.status(e.number===2627||e.number===2601?409:500).json({message:'Erro ao atualizar usuario.'});}
});
app.put('/api/admin/aulas/:id',auth,adminOnly,async(req,res)=>{
  const id=validId(req.params.id),{titulo,duracaoMin}=req.body||{};
  if(!id||typeof titulo!=='string'||!titulo.trim()||!Number.isInteger(Number(duracaoMin))||Number(duracaoMin)<0)return res.status(400).json({message:'Dados de aula invalidos.'});
  try{const pool=await getPool();const r=await pool.request().input('id',sql.Int,id).input('titulo',sql.NVarChar(300),titulo.trim()).input('duracao',sql.Int,Number(duracaoMin)).query('UPDATE dbo.Aulas SET Titulo=@titulo,DuracaoMin=@duracao WHERE Id=@id');return r.rowsAffected[0]?res.json({message:'Aula atualizada.'}):res.status(404).json({message:'Aula nao encontrada.'});}
  catch(e){return res.status(500).json({message:'Erro ao atualizar aula.'});}
});
app.get('/api/aulas/:id',auth,async(req,res)=>{
 const id=validId(req.params.id);if(!id)return res.status(400).json({message:'ID invalido.'});
 try{const pool=await getPool();const r=await pool.request().input('id',sql.Int,id).input('usuarioId',sql.Int,req.user.id).query(`SELECT a.Id AS id,a.CursoId AS cursoId,a.Titulo AS titulo,a.Ordem AS ordem,a.DuracaoMin AS duracaoMin,CASE WHEN p.Id IS NULL THEN CAST(0 AS bit) ELSE CAST(1 AS bit) END AS concluida,c.Ativo AS ativo,c.ProfessorId AS professorId FROM dbo.Aulas a JOIN dbo.Cursos c ON c.Id=a.CursoId LEFT JOIN dbo.Progresso p ON p.AulaId=a.Id AND p.UsuarioId=@usuarioId WHERE a.Id=@id`);
 const a=r.recordset[0];if(!a || (req.user.perfil==='ALUNO'&&!a.ativo) || (req.user.perfil==='PROFESSOR'&&a.professorId!==req.user.id))return res.status(404).json({message:'Aula nao encontrada.'});delete a.ativo;delete a.professorId;return res.json(a);
 }catch(e){return res.status(500).json({message:'Erro ao carregar aula.'});}
});
app.get('/api/progresso/alunos/:id',auth,staffOnly,async(req,res)=>{
 const id=validId(req.params.id);if(!id)return res.status(400).json({message:'ID invalido.'});
 try{const pool=await getPool();const r=await pool.request().input('alunoId',sql.Int,id).input('professorId',sql.Int,req.user.perfil==='PROFESSOR'?req.user.id:0).query(`SELECT c.Id AS id,c.Titulo AS titulo,c.Descricao AS descricao,c.CargaHoraria AS cargaHoraria,c.Ativo AS ativo,COUNT(a.Id) AS totalAulas,COUNT(p.Id) AS concluidas,CASE WHEN COUNT(a.Id)=0 THEN 0 ELSE CAST(ROUND(COUNT(p.Id)*100.0/COUNT(a.Id),0) AS INT) END AS progresso,CASE WHEN EXISTS(SELECT 1 FROM dbo.Matriculas m WHERE m.CursoId=c.Id AND m.UsuarioId=@alunoId) THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS matriculado FROM dbo.Cursos c LEFT JOIN dbo.Aulas a ON a.CursoId=c.Id LEFT JOIN dbo.Progresso p ON p.AulaId=a.Id AND p.UsuarioId=@alunoId WHERE c.Ativo=1 AND (@professorId=0 OR c.ProfessorId=@professorId) GROUP BY c.Id,c.Titulo,c.Descricao,c.CargaHoraria,c.Ativo ORDER BY c.Titulo`);return res.json(r.recordset);
 }catch(e){return res.status(500).json({message:'Erro ao carregar progresso.'});}
});
app.get('/api/gamificacao/alunos/:id',auth,staffOnly,async(req,res)=>{
 const id=validId(req.params.id);if(!id)return res.status(400).json({message:'ID invalido.'});
 try{const pool=await getPool();const r=await pool.request().input('id',sql.Int,id).query(`SELECT u.Id AS id,u.Nome AS nome,ISNULL(g.XP,0) AS xp,CAST(FLOOR(ISNULL(g.XP,0)/100.0) AS INT)+1 AS nivel,ISNULL(g.SequenciaAtual,0) AS sequenciaAtual,ISNULL(g.MelhorSequencia,0) AS melhorSequencia FROM dbo.Usuarios u LEFT JOIN dbo.Gamificacao g ON g.UsuarioId=u.Id WHERE u.Id=@id AND u.Perfil='ALUNO'`);return r.recordset.length?res.json(r.recordset[0]):res.status(404).json({message:'Aluno nao encontrado.'});
 }catch(e){return res.status(500).json({message:'Erro ao consultar gamificacao.'});}
});

// Exclusao administrativa: preserva cursos, remove dependencias em uma transacao.
app.delete('/api/admin/usuarios/:id', auth, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: 'ID invalido.' });
  if (id === req.user.id) return res.status(400).json({ message: 'Voce nao pode excluir a propria conta.' });
  let tx;
  try {
    const pool = await getPool();
    tx = new sql.Transaction(pool);
    await tx.begin();
    const found = await new sql.Request(tx).input('id', sql.Int, id).query(
      'SELECT Id, Perfil, Ativo FROM dbo.Usuarios WITH (UPDLOCK, HOLDLOCK) WHERE Id=@id');
    const user = found.recordset[0];
    if (!user) { await tx.rollback(); return res.status(404).json({ message: 'Usuario nao encontrado.' }); }
    if (user.Perfil === 'ADMIN' && user.Ativo) {
      const count = await new sql.Request(tx).query(
        "SELECT COUNT(*) AS total FROM dbo.Usuarios WITH (UPDLOCK, HOLDLOCK) WHERE Perfil='ADMIN' AND Ativo=1");
      if (count.recordset[0].total <= 1) {
        await tx.rollback(); return res.status(400).json({ message: 'Nao e permitido excluir o ultimo administrador ativo.' });
      }
    }
    const statements = [
      'UPDATE dbo.Cursos SET ProfessorId=NULL WHERE ProfessorId=@id',
      'DELETE FROM dbo.Progresso WHERE UsuarioId=@id',
      'DELETE FROM dbo.HistoricoXP WHERE UsuarioId=@id',
      'DELETE FROM dbo.UsuarioConquistas WHERE UsuarioId=@id',
      'DELETE FROM dbo.Gamificacao WHERE UsuarioId=@id',
      'DELETE FROM dbo.Matriculas WHERE UsuarioId=@id',
      'DELETE FROM dbo.CodigosRecuperacao WHERE UsuarioId=@id',
      'DELETE FROM dbo.Usuarios WHERE Id=@id'
    ];
    for (const statement of statements) {
      await new sql.Request(tx).input('id', sql.Int, id).query(statement);
    }
    await tx.commit();
    return res.json({ message: 'Usuario excluido.' });
  } catch (e) {
    if (tx) { try { await tx.rollback(); } catch {} }
    return res.status(500).json({ message: 'Erro ao excluir usuario.' });
  }
});

app.use((req,res)=>res.status(404).json({message:'Rota nao encontrada.'}));
if (require.main === module) app.listen(PORT,()=>console.log(`API Plataforma Cursos rodando em http://localhost:${PORT}`));
module.exports = app;
