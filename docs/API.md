# Referência da API REST

Base: `https://pim-iv-api.onrender.com/api` ou `http://localhost:3000/api`. Envie JSON com `Content-Type: application/json`. Rotas protegidas exigem `Authorization: Bearer TOKEN`. Os caminhos abaixo são relativos à base.

## Autenticação

| Método | Rota | Acesso |
|---|---|---|
| GET | `/health` | Público |
| POST | `/auth/register` | Público |
| POST | `/auth/login` | Público |
| POST | `/auth/primeiro-acesso` | Token limitado no corpo |
| POST | `/auth/recover` | Público |

Corpos JSON (campos):

- Cadastro: `nome`, `email`, `senha`, `confirmarSenha`. Retorna `id`, `message`, `primeiroAcesso`, `codigoRecuperacao`.
- Login: `email`, `senha`. Retorna `token` e `user` ou `primeiroAcesso: true` e `tokenPrimeiroAcesso`.
- Primeiro acesso: `tokenPrimeiroAcesso`, `senhaTemporaria`, `novaSenha`. Retorna `token`, `user`, `codigoRecuperacao`.
- Recuperação: `email`, `codigoRecuperacao`, `novaSenha`. O código anterior é substituído por um novo.

Senhas de cadastro e redefinição: 8 a 128 caracteres. A nova senha de primeiro acesso deve diferir da temporária. Guarde o código de recuperação em local privado; não o registre em logs.

## Cursos, aulas e gamificação

| Método | Rota | Acesso |
|---|---|---|
| GET | `/cursos` | Autenticado |
| GET | `/cursos/:id` | Autenticado |
| POST | `/cursos/:id/matricula` | Aluno |
| PUT | `/cursos/:cursoId/aulas/:aulaId/progresso` | Aluno |
| GET | `/aulas/:id` | Aluno matriculado, professor responsável ou admin |
| GET | `/gamificacao/me` | Aluno |
| GET | `/gamificacao/turma` | Professor/admin |
| GET | `/gamificacao/alunos/:id` | Professor vinculado/admin |
| GET | `/progresso/alunos/:id` | Professor (próprios cursos)/admin |

Progresso: corpo `{"concluida":true}`. A API protege contra XP duplicado. A consulta de progresso individual retorna uma lista de cursos com `totalAulas`, `concluidas`, `progresso` e `matriculado`.

## Administração

| Método | Rota |
|---|---|
| GET, POST | `/admin/usuarios` |
| GET, PUT, DELETE | `/admin/usuarios/:id` |
| PUT | `/admin/usuarios/:id/status` |
| GET, POST | `/admin/cursos` |
| PUT, DELETE | `/admin/cursos/:id` |
| POST | `/admin/cursos/:cursoId/aulas` |
| PUT, DELETE | `/admin/aulas/:id` |

Cadastro administrativo: `nome`, `email`, `senha`, `perfil` (`ALUNO`, `PROFESSOR`, `ADMIN`). Edição: `nome`, `email`, `perfil`, `ativo`, `senha` opcional. Status: `{"ativo":true}`. Busca de usuários: parâmetro `busca`.

## Professor

| Método | Rota |
|---|---|
| GET, POST | `/professor/cursos` |
| PUT | `/professor/cursos/:id` |
| GET, POST | `/professor/cursos/:id/aulas` |
| PUT, DELETE | `/professor/aulas/:id` |
| GET | `/professor/cursos/:id/alunos` |

Criação e edição de aulas: `{"titulo":"Introdução","duracaoMin":30,"conteudo":"Texto da aula"}`. Omissão de `conteudo` na edição preserva o texto existente.

## Respostas

200 sucesso; 201 criação; 400 dados inválidos ou regra de negócio; 401 autenticação inválida; 403 acesso negado; 404 recurso inexistente ou inacessível; 409 conflito; 429 bloqueio de recuperação; 500 erro interno. As respostas de erro normalmente usam `message`. Esta referência descreve as rotas montadas em `api/src/server.js` e seus routers; não inclui módulos antigos não montados.
