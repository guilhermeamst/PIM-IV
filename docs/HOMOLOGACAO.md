# Testes e homologação

O relatório HTML entregue na Etapa 8 registra 53 testes, 53 aprovados e zero falhas. Trata-se de evidência anterior, com banco simulado; não houve nova execução durante a revisão documental.

Comandos em `api/`: `npm test`, `npm run test:unit`, `npm run test:integration`, `npm run test:report`. Relatório: `api/reports/testes.html`.

## Checklist antes da entrega

- [ ] Confirmar migração e health no Azure SQL.
- [ ] Reexecutar a suíte Node após todas as alterações.
- [ ] Compilar Desktop e Web com .NET 8; iniciar Mobile com Expo compatível.
- [ ] Em cada cliente: cadastro público, login, primeiro acesso, recuperação e código definitivo.
- [ ] Confirmar que redefinição administrativa invalida tokens e códigos anteriores.
- [ ] Testar proteção do último administrador ativo, inclusive alterações concorrentes.
- [ ] Criar curso e aula em um cliente, consultar em outro, editar conteúdo e verificar atualização.
- [ ] Testar matrícula, conclusão, progresso e XP sem duplicação.
- [ ] Verificar bloqueio de aluno não matriculado e professor sem vínculo.
- [ ] Validar progresso administrativo na Web e eliminar login duplicado no Desktop.
- [ ] Revisar mensagens e compatibilidade das três interfaces.
- [ ] Verificar ausência de segredos e arquivos de build no Git.
- [ ] Autorizar deploy e repetir testes essenciais no ambiente publicado.

## Limitações conhecidas

Etapa 7 foi entregue parcialmente (API); ajustes de interface ainda pendentes. Etapa 8 não comprova funcionamento no Azure nem cobre integralmente primeiro acesso e proteção do último administrador. A compilação e execução das interfaces C# e Expo ainda precisam ser verificadas. A documentação não altera código de produção nem remove módulos legados. Não considerar o sistema homologado até concluir o checklist.
