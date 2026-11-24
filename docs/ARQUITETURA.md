# Arquitetura e regras de negócio

Os três clientes usam HTTP/HTTPS para acessar a API Express, que consulta Azure SQL via mssql. O modo SQL legado ainda existe nos clientes C# e não deve ser utilizado no ambiente integrado. Não há sincronização offline garantida: a informação compartilhada depende de consultas à API.

## Entidades

`Usuarios` (identidade e perfil), `Cursos` (professor responsável), `Aulas` (conteúdo e duração), `Matriculas` (vínculo aluno-curso), `Progresso` (conclusão), `Gamificacao`, `Conquistas`, `UsuarioConquistas`, `HistoricoXP` e `CodigosRecuperacao`.

## Permissões

| Operação | Aluno | Professor | Admin |
|---|---|---|---|
| Catálogo autenticado | Sim | Sim | Sim |
| Matrícula, conclusão e XP | Sim | Não | Não |
| Gestão de cursos e aulas | Não | Próprios | Todos |
| Exclusão de curso | Não | Não | Sim |
| Progresso individual de alunos | Não | Vinculados | Todos |
| Ranking global | Não | Sim | Sim |
| Gestão de usuários | Não | Não | Sim |

O cadastro público sempre cria ALUNO. O administrador pode criar os três perfis. A conta administrativa criada ou com senha redefinida deve passar pelo primeiro acesso; o titular recebe o código de recuperação ao definir sua senha definitiva. O aluno cadastrado publicamente recebe o código no cadastro. A recuperação rotaciona o código. Contas antigas sem código necessitam de recuperação assistida.

## Segurança implementada na API

Senhas com scrypt e salt individual; migração de senha legada no login. JWT normal de 8 horas, token limitado de primeiro acesso de 10 minutos, vinculação à senha atual, verificação de conta ativa e perfil. Códigos de recuperação com hash SHA-256 e bloqueio de 15 minutos após cinco tentativas incorretas. Operações administrativas protegem o último administrador ativo. Essas medidas precisam de homologação com o banco real; não constituem auditoria de segurança completa.

O conteúdo individual de aula exige matrícula para alunos e vínculo de propriedade para professores. O progresso individual do professor é limitado aos próprios cursos; a consulta individual de gamificação exige vínculo, mas retorna totais globais do aluno. O ranking também é global para equipe. A consulta administrativa de progresso retorna inclusive cursos sem matrícula, identificados pelo campo `matriculado`.
