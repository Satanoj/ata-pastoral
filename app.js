let mediaRecorder;
let chunks = [];
let audioBlob = null;
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const downloadBtn = document.getElementById('downloadBtn');
const processBtn = document.getElementById('processBtn');
const audio = document.getElementById('audio');
const recStatus = document.getElementById('recStatus');
const serverStatus = document.getElementById('serverStatus');
const transcriptEl = document.getElementById('transcript');
const summaryEl = document.getElementById('summary');

startBtn.onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    mediaRecorder.onstop = () => {
      audioBlob = new Blob(chunks, { type: 'audio/webm' });
      audio.src = URL.createObjectURL(audioBlob);
      downloadBtn.disabled = false;
      processBtn.disabled = false;
      recStatus.textContent = 'Gravação concluída.';
      stream.getTracks().forEach(t => t.stop());
    };
    mediaRecorder.start();
    startBtn.disabled = true;
    stopBtn.disabled = false;
    recStatus.textContent = 'Gravando...';
  } catch (err) {
    recStatus.textContent = 'Erro ao acessar o microfone: ' + err.message;
  }
};

stopBtn.onclick = () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  startBtn.disabled = false;
  stopBtn.disabled = true;
};

downloadBtn.onclick = () => {
  if (!audioBlob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(audioBlob);
  a.download = 'reuniao.webm';
  a.click();
};

processBtn.onclick = async () => {
  if (!audioBlob) return;
  serverStatus.textContent = 'Enviando áudio para o servidor...';
  transcriptEl.value = '';
  summaryEl.value = '';
  const formData = new FormData();
  formData.append('audio', audioBlob, 'reuniao.webm');
  try {
    const res = await fetch('/.netlify/functions/transcribe', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Falha na transcrição');
    transcriptEl.value = data.transcript || '';
    summaryEl.value = data.summary || '';
    serverStatus.textContent = 'Transcrição e resumo concluídos.';
  } catch (err) {
    serverStatus.textContent = 'Erro: ' + err.message;
  }
};
