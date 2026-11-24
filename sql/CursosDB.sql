-- Script base existente, atualizado. Executar no banco alvo, sem CREATE DATABASE ou USE.
IF DB_NAME() <> N'PlataformaCursosDB' THROW 51000, 'Banco incorreto.', 1;
GO
IF OBJECT_ID('dbo.Progresso', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Progresso (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UsuarioId INT NOT NULL,
        AulaId INT NOT NULL,
        DataConclusao DATETIME NOT NULL DEFAULT GETDATE(),

        CONSTRAINT UQ_Progresso
            UNIQUE (UsuarioId, AulaId)
    );
END
GO


IF OBJECT_ID('dbo.Aulas', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Aulas (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CursoId INT NOT NULL,
        Titulo NVARCHAR(300) NOT NULL,
        Ordem INT NOT NULL,
        DuracaoMin INT NOT NULL DEFAULT 0,
        Conteudo NVARCHAR(MAX) NULL
    );
END
GO


IF OBJECT_ID('dbo.Cursos', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Cursos (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Titulo NVARCHAR(200) NOT NULL,
        Descricao NVARCHAR(MAX) NULL,
        CargaHoraria INT NOT NULL DEFAULT 0,
        Ativo BIT NOT NULL DEFAULT 1,
        DataCadastro DATETIME NOT NULL DEFAULT GETDATE()
    );
END
GO


IF OBJECT_ID('dbo.Usuarios', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Usuarios (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Nome NVARCHAR(200) NOT NULL,
        Email NVARCHAR(200) NOT NULL UNIQUE,
        Senha NVARCHAR(200) NOT NULL,
        Perfil NVARCHAR(20) NOT NULL,
        PrimeiroAcesso BIT NOT NULL CONSTRAINT DF_Usuarios_PrimeiroAcesso DEFAULT (0),
        Ativo BIT NOT NULL DEFAULT 1,
        DataCadastro DATETIME NOT NULL DEFAULT GETDATE()
    );
END
GO


GO


IF NOT EXISTS (
    SELECT 1
    FROM dbo.Cursos
)
BEGIN
    INSERT dbo.Cursos (
        Titulo,
        Descricao,
        CargaHoraria,
        Ativo
    )
    VALUES
        (
            'Introdução à Programação',
            'Fundamentos de lógica, algoritmos e primeiros programas.',
            20,
            1
        ),
        (
            'Banco de Dados com SQL Server',
            'Conceitos de banco de dados e comandos SQL.',
            30,
            1
        );

    INSERT dbo.Aulas (
        CursoId,
        Titulo,
        Ordem,
        DuracaoMin
    )
    SELECT
        Id,
        'Lógica de programação e algoritmos',
        1,
        60
    FROM dbo.Cursos
    WHERE Titulo = 'Introdução à Programação';

    INSERT dbo.Aulas (
        CursoId,
        Titulo,
        Ordem,
        DuracaoMin
    )
    SELECT
        Id,
        'Variáveis, condições e repetição',
        2,
        60
    FROM dbo.Cursos
    WHERE Titulo = 'Introdução à Programação';

    INSERT dbo.Aulas (
        CursoId,
        Titulo,
        Ordem,
        DuracaoMin
    )
    SELECT
        Id,
        'SELECT, INSERT, UPDATE e DELETE',
        1,
        70
    FROM dbo.Cursos
    WHERE Titulo = 'Banco de Dados com SQL Server';
END
GO


IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_Aulas_Cursos'
)
BEGIN
    ALTER TABLE dbo.Aulas
    ADD CONSTRAINT FK_Aulas_Cursos
        FOREIGN KEY (CursoId)
        REFERENCES dbo.Cursos(Id)
        ON DELETE CASCADE;
END


IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_Progresso_Usuarios'
)
BEGIN
    ALTER TABLE dbo.Progresso
    ADD CONSTRAINT FK_Progresso_Usuarios
        FOREIGN KEY (UsuarioId)
        REFERENCES dbo.Usuarios(Id)
        ON DELETE CASCADE;
END


IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_Progresso_Aulas'
)
BEGIN
    ALTER TABLE dbo.Progresso
    ADD CONSTRAINT FK_Progresso_Aulas
        FOREIGN KEY (AulaId)
        REFERENCES dbo.Aulas(Id)
        ON DELETE CASCADE;
END
GO

GO
-- Etapa 1: executar conectado diretamente ao PlataformaCursosDB no Azure.
SET XACT_ABORT ON;
SET NOCOUNT ON;
IF DB_NAME() <> N'PlataformaCursosDB' THROW 51000, 'Banco incorreto. Conecte ao PlataformaCursosDB.', 1;
IF OBJECT_ID('dbo.Usuarios','U') IS NULL OR OBJECT_ID('dbo.Aulas','U') IS NULL THROW 51001, 'Tabelas base ausentes.', 1;
BEGIN TRY
 BEGIN TRANSACTION;
 IF COL_LENGTH('dbo.Usuarios','PrimeiroAcesso') IS NULL
  ALTER TABLE dbo.Usuarios ADD PrimeiroAcesso BIT NOT NULL CONSTRAINT DF_Usuarios_PrimeiroAcesso DEFAULT (0) WITH VALUES;
 IF COL_LENGTH('dbo.Aulas','Conteudo') IS NULL
  ALTER TABLE dbo.Aulas ADD Conteudo NVARCHAR(MAX) NULL;
 IF OBJECT_ID('dbo.CodigosRecuperacao','U') IS NULL
 BEGIN
  CREATE TABLE dbo.CodigosRecuperacao (
   UsuarioId INT NOT NULL PRIMARY KEY,
   CodigoHash CHAR(64) NOT NULL,
   Tentativas INT NOT NULL CONSTRAINT DF_CodRec_Tentativas DEFAULT (0),
   BloqueadoAte DATETIME2 NULL,
   CONSTRAINT FK_CodRec_Usuarios FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios(Id) ON DELETE CASCADE
  );
 END;
 IF EXISTS (SELECT 1 FROM (VALUES ('UsuarioId','int',4,0),('CodigoHash','char',64,0),('Tentativas','int',4,0),('BloqueadoAte','datetime2',8,1)) e(nome,tipo,tamanho,nulo)
 LEFT JOIN sys.columns c ON c.object_id=OBJECT_ID('dbo.CodigosRecuperacao') AND c.name=e.nome
 WHERE c.column_id IS NULL OR TYPE_NAME(c.system_type_id)<>e.tipo OR (e.nome<>'BloqueadoAte' AND c.max_length<>e.tamanho) OR c.is_nullable<>e.nulo)
 THROW 51002, 'Estrutura de recuperacao incompatível; revisar manualmente.', 1;
 IF NOT EXISTS (SELECT 1 FROM sys.indexes i JOIN sys.index_columns ic ON i.object_id=ic.object_id AND i.index_id=ic.index_id JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE i.object_id=OBJECT_ID('dbo.CodigosRecuperacao') AND i.is_primary_key=1 AND c.name='UsuarioId' AND ic.key_ordinal=1 AND NOT EXISTS (SELECT 1 FROM sys.index_columns x WHERE x.object_id=i.object_id AND x.index_id=i.index_id AND x.key_ordinal>1)) THROW 51003, 'Chave primaria de recuperacao incompatível.', 1;
 IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys f JOIN sys.foreign_key_columns k ON k.constraint_object_id=f.object_id WHERE f.parent_object_id=OBJECT_ID('dbo.CodigosRecuperacao') AND f.referenced_object_id=OBJECT_ID('dbo.Usuarios') AND COL_NAME(k.parent_object_id,k.parent_column_id)='UsuarioId' AND COL_NAME(k.referenced_object_id,k.referenced_column_id)='Id' AND f.delete_referential_action=1 AND f.is_disabled=0 AND f.is_not_trusted=0) THROW 51004, 'Relacionamento de recuperacao incompatível.', 1;
 IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.Usuarios') AND name='PrimeiroAcesso' AND system_type_id=104 AND is_nullable=0 AND default_object_id<>0) THROW 51005, 'PrimeiroAcesso incompatível.', 1;
 IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.Aulas') AND name='Conteudo' AND system_type_id=231 AND max_length=-1 AND is_nullable=1) THROW 51006, 'Conteudo incompatível.', 1;
 IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.CodigosRecuperacao') AND name='Tentativas' AND default_object_id<>0) THROW 51007, 'Tentativas sem valor padrao.', 1;
 COMMIT TRANSACTION;
 PRINT 'Etapa 1 aplicada com sucesso.';
END TRY
BEGIN CATCH
 IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
 THROW;
END CATCH;
