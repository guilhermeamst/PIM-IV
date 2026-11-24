# Instalação e publicação

## Banco de dados

No SSMS, conecte-se diretamente ao banco Azure SQL `PlataformaCursosDB`. Faça backup ou confirme a possibilidade de restauração antes de alterações. Execute `sql/DiagnosticoBanco.sql`, revise o resultado, aplique `sql/Etapa1_Migracao.sql` e execute `sql/Validar_Etapa1.sql`. A migração adiciona `Usuarios.PrimeiroAcesso` e `Aulas.Conteudo` e verifica a estrutura de recuperação. Não execute o script principal `CursosDB.sql` sobre produção sem revisão; ele é destinado à inicialização.

## API local

Crie `api/.env` (não versionar):

```dotenv
PORT=3000
DB_SERVER=database-pim-iv.database.windows.net
DB_DATABASE=PlataformaCursosDB
DB_USER=SEU_USUARIO
DB_PASSWORD=SUA_SENHA
DB_PORT=1433
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=false
JWT_SECRET=SUBSTITUIR_POR_CHAVE_ALEATORIA_DE_32_OU_MAIS_CARACTERES
```

Gere a chave com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Autorize somente as origens necessárias no firewall Azure. Execute `npm ci` e `npm start` dentro de `api`. Consulte `http://localhost:3000/api/health`; a resposta esperada é `{"api":"ok","database":"ok"}`.

## Clientes

- Mobile: configure `mobile/.env` com `EXPO_PUBLIC_API_URL=https://pim-iv-api.onrender.com/api`. Para API local, use `http://10.0.2.2:3000/api` no emulador Android ou o IP LAN do computador no celular físico. Execute `npm ci` e `npx expo start -c` em `mobile/`. Utilize uma versão do Expo Go ou development build compatível com o SDK do projeto.
- Desktop: Windows e SDK .NET 8. Use o perfil `API (Azure)` ou configure `API_ATIVA=true` e `API_URL` com a URL base sem `/api`.
- Web: SDK .NET 8. Use o perfil `API (Azure)` ou configure `Api__Ativa=true` e `Api__UrlBase` com a URL base sem `/api`. O endereço local é informado pelo terminal ao iniciar.

Para testar localmente sem os perfis de lançamento, no PowerShell configure as variáveis do respectivo cliente e use `dotnet run --project CAMINHO_DO_CSPROJ --no-launch-profile`.

## Render

Serviço Node.js, branch `deploy-api`, Root Directory `api`, Build Command `npm ci`, Start Command `npm start`. Configure as variáveis do backend no painel do Render, sem publicar segredos. Configure o firewall Azure para a origem autorizada do serviço. A alteração de JWT_SECRET invalida sessões existentes.

Antes do deploy: aplicar e validar migração, executar testes, compilar os clientes, validar primeiro acesso e recuperação em todas as plataformas. Evite push para a branch de deploy enquanto houver incompatibilidades. Após autorização, publique e confira `/api/health` e os fluxos de homologação. Em caso de falha, interrompa a publicação e avalie rollback de código compatível com o esquema migrado.
