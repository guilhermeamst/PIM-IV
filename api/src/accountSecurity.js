const crypto = require('crypto');
const {
  promisify
} = require('util');
const scrypt = promisify(crypto.scrypt);
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  if (!stored.startsWith('scrypt:')) return stored === password; // compatibilidade com contas antigas
  const parts = stored.split(':');
  if (parts.length !== 3 || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{128}$/.test(parts[2])) return false;
  const expected = Buffer.from(parts[2], 'hex');
  const actual = await scrypt(password, parts[1], expected.length);
  return crypto.timingSafeEqual(expected, actual);
}
function validateAccount(body, publicSignup = false) {
  const nome = typeof body?.nome === 'string' ? body.nome.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const senha = typeof body?.senha === 'string' ? body.senha : '';
  const perfil = publicSignup ? 'ALUNO' : typeof body?.perfil === 'string' ? body.perfil.toUpperCase() : '';
  if (nome.length < 3 || nome.length > 200) return {
    error: 'Informe um nome entre 3 e 200 caracteres.'
  };
  if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return {
    error: 'Informe um email valido.'
  };
  if (senha.length < 8 || senha.length > 128) return {
    error: 'A senha deve ter entre 8 e 128 caracteres.'
  };
  if (publicSignup && senha !== body.confirmarSenha) return {
    error: 'As senhas nao conferem.'
  };
  if (!['ALUNO', 'PROFESSOR', 'ADMIN'].includes(perfil)) return {
    error: 'Perfil invalido.'
  };
  return {
    nome,
    email,
    senha,
    perfil
  };
}
function newRecoveryCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(16);
  const code = Array.from(bytes, b => chars[b % chars.length]).join('');
  return code.match(/.{1,4}/g).join('-');
}
function codeDigest(code) {
  return crypto.createHash('sha256').update(code.replace(/-/g, '').toUpperCase()).digest('hex');
}
function normalizeCode(code) {
  return typeof code === 'string' ? code.trim().toUpperCase().replace(/[-\s]/g, '') : '';
}
module.exports = {
  hashPassword,
  verifyPassword,
  validateAccount,
  newRecoveryCode,
  codeDigest,
  normalizeCode
};
