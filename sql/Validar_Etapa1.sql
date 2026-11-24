-- Somente leitura. Executar depois da migracao.
SELECT DB_NAME() AS Banco;
SELECT OBJECT_NAME(object_id) AS Tabela, name AS Coluna, TYPE_NAME(system_type_id) AS Tipo, max_length, is_nullable, OBJECT_DEFINITION(default_object_id) AS ValorPadrao FROM sys.columns WHERE (object_id=OBJECT_ID('dbo.Usuarios') AND name='PrimeiroAcesso') OR (object_id=OBJECT_ID('dbo.Aulas') AND name='Conteudo') OR object_id=OBJECT_ID('dbo.CodigosRecuperacao');
SELECT COUNT_BIG(*) AS Usuarios, COALESCE(SUM(CONVERT(bigint,PrimeiroAcesso)),0) AS PrimeiroAcessoPendente FROM dbo.Usuarios;
SELECT COUNT_BIG(*) AS Aulas, COUNT_BIG(Conteudo) AS AulasComConteudo FROM dbo.Aulas;
SELECT COUNT_BIG(*) AS CodigosExistentes FROM dbo.CodigosRecuperacao;
