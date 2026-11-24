function validateLesson(body = {}) {
  const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
  const duracaoMin = Number(body.duracaoMin);
  const conteudo = body.conteudo;
  if (!titulo || titulo.length > 300 || body.duracaoMin == null || body.duracaoMin === '' || !Number.isInteger(duracaoMin) || duracaoMin < 0 || duracaoMin > 2147483647 || (conteudo !== undefined && conteudo !== null && typeof conteudo !== 'string')) return null;
  return { titulo, duracaoMin, conteudo: conteudo ?? null, hasContent: conteudo !== undefined };
}
module.exports = { validateLesson };
