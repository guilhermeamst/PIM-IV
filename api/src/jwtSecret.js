const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32 || secret === 'plataforma-cursos-segredo') throw new Error('Configure JWT_SECRET com pelo menos 32 caracteres aleatorios.');
module.exports = secret;
