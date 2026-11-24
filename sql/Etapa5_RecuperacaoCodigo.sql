-- Execute conectado diretamente ao banco PlataformaCursosDB.
IF OBJECT_ID('dbo.Usuarios','U') IS NULL THROW 50000, 'Banco incorreto.', 1;
IF OBJECT_ID('dbo.CodigosRecuperacao','U') IS NULL
BEGIN
 CREATE TABLE dbo.CodigosRecuperacao (
 UsuarioId INT NOT NULL PRIMARY KEY,
 CodigoHash CHAR(64) NOT NULL,
 Tentativas INT NOT NULL DEFAULT 0,
 BloqueadoAte DATETIME2 NULL,
 FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios(Id) ON DELETE CASCADE);
END;
IF COL_LENGTH('dbo.CodigosRecuperacao','CodigoHash') IS NULL THROW 50001, 'Tabela legada: requer migracao manual.', 1;
