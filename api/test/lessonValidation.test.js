const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateLesson
} = require('../src/lessonValidation');
test('aula valida normaliza titulo e duracao', () => assert.deepEqual(validateLesson({
  titulo: ' Aula ',
  duracaoMin: '30',
  conteudo: 'Texto'
}), {
  titulo: 'Aula',
  duracaoMin: 30,
  conteudo: 'Texto',
  hasContent: true
}));
test('conteudo omitido difere de conteudo explicitamente nulo', () => {
  assert.equal(validateLesson({
    titulo: 'Aula',
    duracaoMin: 0
  }).hasContent, false);
  assert.equal(validateLesson({
    titulo: 'Aula',
    duracaoMin: 0,
    conteudo: null
  }).hasContent, true);
});
for (const [name, body] of Object.entries({
  tituloVazio: {
    titulo: ' ',
    duracaoMin: 1
  },
  tituloLongo: {
    titulo: 'a'.repeat(301),
    duracaoMin: 1
  },
  duracaoNegativa: {
    titulo: 'A',
    duracaoMin: -1
  },
  duracaoFracionaria: {
    titulo: 'A',
    duracaoMin: 1.5
  },
  duracaoAusente: {
    titulo: 'A'
  },
  conteudoInvalido: {
    titulo: 'A',
    duracaoMin: 1,
    conteudo: 123
  }
})) test('rejeita ' + name, () => assert.equal(validateLesson(body), null));
