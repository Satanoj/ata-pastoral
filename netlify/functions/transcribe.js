const { OpenAI } = require('openai');
const busboy = require('busboy');

function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: event.headers });
    let fileBuffer = null;
    let filename = 'audio.webm';
    let mimeType = 'audio/webm';
    bb.on('file', (_name, file, info) => {
      filename = info.filename || filename;
      mimeType = info.mimeType || mimeType;
      const chunks = [];
      file.on('data', data => chunks.push(data));
      file.on('end', () => { fileBuffer = Buffer.concat(chunks); });
    });
    bb.on('close', () => resolve({ fileBuffer, filename, mimeType }));
    bb.on('error', reject);
    bb.end(Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8'));
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido.' }) };
  }
  if (!process.env.OPENAI_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'OPENAI_API_KEY não configurada no Netlify.' }) };
  }
  try {
    const { fileBuffer, filename, mimeType } = await parseMultipart(event);
    if (!fileBuffer) return { statusCode: 400, body: JSON.stringify({ error: 'Nenhum áudio recebido.' }) };
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const file = new File([fileBuffer], filename, { type: mimeType });
    const tr = await client.audio.transcriptions.create({
      model: 'gpt-4o-mini-transcribe',
      file,
      response_format: 'text',
      language: 'pt'
    });
    const transcript = typeof tr === 'string' ? tr : (tr.text || String(tr));
    const summaryResponse = await client.responses.create({
      model: 'gpt-4.1-mini',
      input: `Você é secretário de reunião de igreja. A partir da transcrição abaixo, produza em português: 1) resumo objetivo; 2) decisões tomadas; 3) pendências e responsáveis, quando houver; 4) ata formal em linguagem eclesiástica. Não invente nomes nem decisões.\n\nTRANSCRIÇÃO:\n${transcript}`
    });
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript, summary: summaryResponse.output_text }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Erro interno.' }) };
  }
};
