-- Execute uma vez no Azure SQL antes de iniciar a API atualizada.
IF OBJECT_ID('dbo.CodigosRecuperacao', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CodigosRecuperacao (
    UsuarioId INT NOT NULL PRIMARY KEY,
    CodigoHash CHAR(64) NOT NULL,
    Tentativas INT NOT NULL CONSTRAINT DF_CodRec_Tentativas DEFAULT (0),
    BloqueadoAte DATETIME2 NULL,
    CONSTRAINT FK_CodRec_Usuarios FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios(Id) ON DELETE CASCADE
  );
END;
-- Contas antigas nao possuem codigo. Precisam de uma estrategia de migracao
-- com verificacao de identidade; nunca entregue codigos usando apenas o email.
