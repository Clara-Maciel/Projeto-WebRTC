const socket = io();

let pc = null;
let dataChannel = null;
let localStream = null;
let nomeUsuario = '';
let nomeSala = '';
let micAtivo = false;
let camAtiva = false;

const STUN = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const telaEntrada  = document.getElementById('tela-entrada');
const telaChat     = document.getElementById('tela-chat');
const localVideo   = document.getElementById('local-video');
const remoteVideo  = document.getElementById('remote-video');
const mensagensDiv = document.getElementById('mensagens');
const inputMsg     = document.getElementById('input-msg');
const badgeStatus  = document.getElementById('badge-status');
const btnMic       = document.getElementById('btn-mic');
const btnCam       = document.getElementById('btn-cam');

// ===== ENTRAR NA SALA =====
async function entrarNaSala() {
  const nome = document.getElementById('input-nome').value.trim();
  const sala = document.getElementById('input-sala').value.trim();
  if (!nome) { alert('Digite seu nome!'); return; }
  if (!sala)  { alert('Digite o nome da sala!'); return; }

  nomeUsuario = nome;
  nomeSala    = sala;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    // mic e câmera começam desligados
    localStream.getAudioTracks().forEach(t => t.enabled = false);
    localStream.getVideoTracks().forEach(t => t.enabled = false);
    document.getElementById('local-video').srcObject = localStream;
  } catch (err) {
    msgSistema('Câmera/microfone não encontrado. Só o chat estará disponível.');
  }

  socket.emit('join', nomeSala);
  document.getElementById('label-sala').textContent = sala;

  telaEntrada.classList.add('escondido');
  telaChat.classList.remove('escondido');

  // Inicia chamada automaticamente
  criarPeerConnection();
  dataChannel = pc.createDataChannel('chat');
  configurarDataChannel(dataChannel);
  if (localStream) localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('offer', { room: nomeSala, sdp: offer });
  atualizarStatus('Aguardando...');
}

// ===== CRIAR PEER CONNECTION =====
function criarPeerConnection() {
  pc = new RTCPeerConnection(STUN);

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) socket.emit('ice-candidate', { room: nomeSala, candidate });
  };

  pc.ontrack = ({ streams }) => {
    document.getElementById('remote-video').srcObject = streams[0];
    atualizarStatus('Conectado', true);
  };

  pc.ondatachannel = ({ channel }) => {
    dataChannel = channel;
    configurarDataChannel(channel);
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected')    atualizarStatus('Conectado', true);
    if (pc.connectionState === 'disconnected') atualizarStatus('Desconectado');
  };
}

// ===== DATA CHANNEL =====
function configurarDataChannel(channel) {
  channel.onopen    = () => atualizarStatus('Conectado', true);
  channel.onclose   = () => atualizarStatus('Desconectado');
  channel.onmessage = ({ data }) => {
    const { texto, nome } = JSON.parse(data);
    adicionarMensagem(texto, nome, 'outro');
  };
}

// ===== ENCERRAR =====
function encerrarChamada() {
  if (pc) { pc.close(); pc = null; }
  if (localStream) { localStream.getTracks().forEach(t => t.stop()); }
  socket.disconnect();
  location.reload();
}

// ===== TOGGLE MIC =====
function toggleMic() {
  if (!localStream) return;
  micAtivo = !micAtivo;
  localStream.getAudioTracks().forEach(t => t.enabled = micAtivo);
  btnMic.classList.toggle('desligado', !micAtivo);
}

// ===== TOGGLE CAM =====
function toggleCam() {
  if (!localStream) return;
  camAtiva = !camAtiva;
  localStream.getVideoTracks().forEach(t => t.enabled = camAtiva);
  btnCam.classList.toggle('desligado', !camAtiva);
}

// ===== ENVIAR MENSAGEM =====
function enviarMensagem() {
  const texto = inputMsg.value.trim();
  if (!texto) return;
  if (!dataChannel || dataChannel.readyState !== 'open') {
    msgSistema('Aguarde a conexão com o outro usuário.');
    return;
  }
  dataChannel.send(JSON.stringify({ texto, nome: nomeUsuario }));
  adicionarMensagem(texto, nomeUsuario, 'eu');
  inputMsg.value = '';
}

// ===== RENDERIZAR MENSAGEM =====
function adicionarMensagem(texto, nome, tipo) {
  const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const wrap = document.createElement('div');
  wrap.className = `bolha-wrap ${tipo}`;

  if (tipo === 'outro') {
    const nomeEl = document.createElement('div');
    nomeEl.className = 'bolha-nome';
    nomeEl.textContent = nome;
    wrap.appendChild(nomeEl);
  }

  const bolha = document.createElement('div');
  bolha.className = `bolha ${tipo}`;
  bolha.textContent = texto;

  const horaEl = document.createElement('div');
  horaEl.className = 'bolha-hora';
  horaEl.textContent = hora;
  bolha.appendChild(horaEl);

  wrap.appendChild(bolha);
  mensagensDiv.appendChild(wrap);
  mensagensDiv.scrollTop = mensagensDiv.scrollHeight;
}

function msgSistema(texto) {
  const div = document.createElement('div');
  div.className = 'msg-sistema';
  div.textContent = texto;
  mensagensDiv.appendChild(div);
  mensagensDiv.scrollTop = mensagensDiv.scrollHeight;
}

function atualizarStatus(texto, online = false) {
  badgeStatus.textContent = texto;
  badgeStatus.classList.toggle('online', online);
}

// ===== EVENTOS SOCKET =====
socket.on('user-joined', () => msgSistema('Outro usuário entrou na sala.'));

socket.on('offer', async (data) => {
  criarPeerConnection();
  if (localStream) localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  await pc.setRemoteDescription(data.sdp);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('answer', { room: nomeSala, sdp: answer });
  atualizarStatus('Conectando...');
});

socket.on('answer', async (data) => {
  await pc.setRemoteDescription(data.sdp);
});

socket.on('ice-candidate', async ({ candidate }) => {
  if (pc) await pc.addIceCandidate(candidate);
});