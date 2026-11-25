const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hashPassword,
  verifyPassword,
  validateAccount,
  newRecoveryCode,
  codeDigest,
  normalizeCode
} = require('../src/accountSecurity');
const valid = {
  nome: ' Aluno Teste ',
  email: ' TESTE@example.com ',
  senha: 'Teste1234',
  confirmarSenha: 'Teste1234',
  perfil: 'ADMIN'
};
test('hash scrypt tem formato esperado e nao contem senha', async () => {
  const h = await hashPassword(valid.senha);
  assert.match(h, /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);
  assert.ok(!h.includes(valid.senha));
});
test('salt diferente para senhas iguais', async () => assert.notEqual(await hashPassword(valid.senha), await hashPassword(valid.senha)));
test('verifica senha correta e rejeita incorreta', async () => {
  const h = await hashPassword(valid.senha);
  assert.equal(await verifyPassword(valid.senha, h), true);
  assert.equal(await verifyPassword('errada', h), false);
});
test('rejeita hash malformado e valor nulo', async () => {
  assert.equal(await verifyPassword('x', 'scrypt:abc'), false);
  assert.equal(await verifyPassword('x', null), false);
});
test('compatibilidade legada atual', async () => {
  assert.equal(await verifyPassword('antiga', 'antiga'), true);
  assert.equal(await verifyPassword('errada', 'antiga'), false);
});
test('cadastro publico normaliza dados e impede escalada de perfil', () => assert.deepEqual(validateAccount(valid, true), {
  nome: 'Aluno Teste',
  email: 'teste@example.com',
  senha: valid.senha,
  perfil: 'ALUNO'
}));
for (const [label, patch] of Object.entries({
  'nome curto': {
    nome: 'ab'
  },
  'email invalido': {
    email: 'abc'
  },
  'senha curta': {
    senha: '123'
  },
  'senha longa': {
    senha: 'x'.repeat(129)
  },
  'confirmacao diferente': {
    confirmarSenha: 'outra'
  }
})) test('rejeita ' + label, () => assert.ok(validateAccount({
  ...valid,
  ...patch
}, true).error));
test('admin pode cadastrar professor', () => assert.equal(validateAccount({
  ...valid,
  perfil: 'professor'
}, false).perfil, 'PROFESSOR'));
test('rejeita perfil desconhecido', () => assert.ok(validateAccount({
  ...valid,
  perfil: 'ROOT'
}, false).error));
test('codigo de recuperacao possui 16 caracteres validos', () => assert.match(newRecoveryCode(), /^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$/));
test('normalizacao de codigo', () => assert.equal(normalizeCode(' abcd- efgh '), 'ABCDEFGH'));
test('digest SHA256 independe de caixa e hifens', () => {
  assert.match(codeDigest('ABCD-EFGH'), /^[a-f0-9]{64}$/);
  assert.equal(codeDigest('ABCD-EFGH'), codeDigest('abcdefgh'));
});
