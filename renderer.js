/**
 * BingHo - RENDERER & STATE LOGIC
 * Modo Doble Pantalla (Operador + Proyector Maximizado en Pantalla Extendida),
 * Persistencia Total (Anti-Crash), Modo Auditoría con Zoom Verde/Rojo,
 * Botón de Cartón Ganador con Festejo y Confeti Sincronizado,
 * Actualizador Integrado desde GitHub Releases,
 * Control Deslizante de Tamaño de Fuente (60%-130%), Corrección Inline y Tablero Bloqueado.
 */

// ==========================================================================
// 1. ESTADO GLOBAL & DETECCIÓN DE MODO
// ==========================================================================
const STORAGE_KEY = 'bingho_state_v3';
const urlParams = new URLSearchParams(window.location.search);
const isProjectorMode = urlParams.get('mode') === 'projector';

const state = {
  numerosSalidos: [], // Array de números cantados en orden cronológico
  numerosAuditados: [], // Array de números auditados (verdes o rojos) en modo Bingo
  isBingoMode: false, // false: Modo Sorteo | true: Modo Bingo (Auditoría)
  drawTitle: 'SORTEO N° 001',
  currentTheme: 'clasico',
  fontScale: 100, // Escala de fuente (60 a 130)
  soundPreset: isProjectorMode ? 'silencio' : 'clasico', // 'clasico' | 'arcade' | 'marimba' | 'digital' | 'campana' | 'silencio'
  audioCtx: null
};

// Canal Broadcast para sincronización ultra rápida entre ventanas
let syncChannel = null;
try {
  syncChannel = new BroadcastChannel('bingho_dual_screen_sync');
} catch (e) {}

// ==========================================================================
// 2. REFERENCIAS DOM
// ==========================================================================
const DOM = {
  bingoBoard: document.getElementById('bingoBoard'),
  numberInput: document.getElementById('numberInput'),
  btnSubmitNumber: document.getElementById('btnSubmitNumber'),
  btnBingoToggle: document.getElementById('btnBingoToggle'),
  bingoStatusText: document.getElementById('bingoStatusText'),
  btnWinnerCelebration: document.getElementById('btnWinnerCelebration'),
  drawTitleInput: document.getElementById('drawTitleInput'),
  drawTitleDisplay: document.getElementById('drawTitleDisplay'),
  statCounter: document.getElementById('statCounter'),
  currentNumberDisplay: document.getElementById('currentNumberDisplay'),
  auditStatusBadge: document.getElementById('auditStatusBadge'),
  historyChips: document.getElementById('historyChips'),
  auditToast: document.getElementById('auditToast'),
  auditToastIcon: document.getElementById('auditToastIcon'),
  auditToastTitle: document.getElementById('auditToastTitle'),
  auditToastDesc: document.getElementById('auditToastDesc'),
  inputLabel: document.getElementById('inputLabel'),
  inputHint: document.getElementById('inputHint'),
  
  // Slider de Tamaño de Fuente
  fontSizeSlider: document.getElementById('fontSizeSlider'),
  fontSizeValue: document.getElementById('fontSizeValue'),

  // Corrección Inline de Errores
  removeInlineInput: document.getElementById('removeInlineInput'),
  btnRemoveInline: document.getElementById('btnRemoveInline'),
  btnUndo: document.getElementById('btnUndo'),

  // Acciones y Herramientas del Sistema
  btnProjectorToggle: document.getElementById('btnProjectorToggle'),
  projectorBtnText: document.getElementById('projectorBtnText'),
  btnCheckUpdates: document.getElementById('btnCheckUpdates'),
  updateBtnText: document.getElementById('updateBtnText'),
  btnFullscreen: document.getElementById('btnFullscreen'),
  fullscreenText: document.getElementById('fullscreenText'),
  soundPresetSelect: document.getElementById('soundPresetSelect'),
  soundSelectIcon: document.getElementById('soundSelectIcon'),
  btnReset: document.getElementById('btnReset'),
  themeButtons: document.querySelectorAll('.btn-theme-chip'),

  // Modal de Confirmación de Nuevo Sorteo
  confirmModalOverlay: document.getElementById('confirmModalOverlay'),
  btnCancelReset: document.getElementById('btnCancelReset'),
  btnConfirmReset: document.getElementById('btnConfirmReset'),

  // Superposición de Celebración de Ganador
  winnerOverlay: document.getElementById('winnerOverlay'),
  confettiCanvas: document.getElementById('confettiCanvas'),
  winnerSubtitle: document.getElementById('winnerSubtitle'),
  btnCloseWinner: document.getElementById('btnCloseWinner'),

  // Versión y Créditos
  leftBarVersionBadge: document.getElementById('leftBarVersionBadge'),
  appVersionBadge: document.getElementById('appVersionBadge'),
  footerVersionText: document.getElementById('footerVersionText'),

  // Modal de Actualizaciones desde GitHub
  updateModalOverlay: document.getElementById('updateModalOverlay'),
  updateModalIcon: document.getElementById('updateModalIcon'),
  updateModalTitle: document.getElementById('updateModalTitle'),
  updateModalDesc: document.getElementById('updateModalDesc'),
  updateNotesBox: document.getElementById('updateNotesBox'),
  updateProgressContainer: document.getElementById('updateProgressContainer'),
  updateProgressBar: document.getElementById('updateProgressBar'),
  updateProgressText: document.getElementById('updateProgressText'),
  updateProgressSize: document.getElementById('updateProgressSize'),
  btnCancelUpdate: document.getElementById('btnCancelUpdate'),
  btnManualDownload: document.getElementById('btnManualDownload'),
  btnDownloadUpdate: document.getElementById('btnDownloadUpdate'),
  btnDonationCafecito: document.getElementById('btnDonationCafecito')
};

let updateDownloadUrl = '';
let updateReleasePageUrl = '';

// ==========================================================================
// 3. SINCRONIZACIÓN OPERADOR <-> PROYECTOR
// ==========================================================================

function broadcastState() {
  if (isProjectorMode) return;
  const payload = {
    numerosSalidos: state.numerosSalidos,
    numerosAuditados: state.numerosAuditados,
    isBingoMode: state.isBingoMode,
    drawTitle: state.drawTitle,
    currentTheme: state.currentTheme,
    fontScale: state.fontScale
  };
  if (window.electronAPI && window.electronAPI.sendStateSync) {
    window.electronAPI.sendStateSync(payload);
  }
  if (syncChannel) {
    syncChannel.postMessage({ type: 'state-sync', payload });
  }
}

function broadcastEvent(eventType, eventData = {}) {
  if (isProjectorMode) return;
  if (window.electronAPI && window.electronAPI.sendEventSync) {
    window.electronAPI.sendEventSync({ eventType, eventData });
  }
  if (syncChannel) {
    syncChannel.postMessage({ type: 'event-sync', eventType, eventData });
  }
}

function applyExternalState(payload) {
  if (!payload) return;

  if (Array.isArray(payload.numerosSalidos)) {
    state.numerosSalidos = [...payload.numerosSalidos];
    refreshBoardFromState();
  }

  if (Array.isArray(payload.numerosAuditados)) {
    state.numerosAuditados = [...payload.numerosAuditados];
  }

  if (typeof payload.isBingoMode === 'boolean') {
    state.isBingoMode = payload.isBingoMode;
    if (DOM.auditStatusBadge) {
      DOM.auditStatusBadge.style.display = state.isBingoMode ? 'flex' : 'none';
    }
    if (DOM.btnBingoToggle) {
      if (state.isBingoMode) {
        DOM.btnBingoToggle.classList.add('active');
        DOM.btnBingoToggle.setAttribute('aria-pressed', 'true');
        DOM.bingoStatusText.textContent = '● AUDITORÍA';
      } else {
        DOM.btnBingoToggle.classList.remove('active');
        DOM.btnBingoToggle.setAttribute('aria-pressed', 'false');
        DOM.bingoStatusText.textContent = 'SORTEO';
      }
    }
    if (DOM.btnWinnerCelebration) {
      DOM.btnWinnerCelebration.disabled = !state.isBingoMode;
    }
    if (!state.isBingoMode) {
      state.numerosAuditados = [];
      document.querySelectorAll('.cell-audit-valid, .cell-audit-invalid').forEach(c => {
        c.classList.remove('cell-audit-valid', 'cell-audit-invalid');
      });
      if (DOM.auditToast) DOM.auditToast.style.display = 'none';
      hideWinnerCelebration(false);
    } else {
      // Re-aplicar clases de auditoría activas
      document.querySelectorAll('.cell-audit-valid, .cell-audit-invalid').forEach(cell => {
        const num = parseInt(cell.dataset.number, 10);
        if (!state.numerosAuditados.includes(num)) {
          cell.classList.remove('cell-audit-valid', 'cell-audit-invalid');
        }
      });
      state.numerosAuditados.forEach(num => {
        const cell = document.getElementById(`cell-${num}`);
        if (cell) {
          if (state.numerosSalidos.includes(num)) {
            cell.classList.remove('cell-audit-invalid');
            cell.classList.add('cell-audit-valid');
          } else {
            cell.classList.remove('cell-audit-valid');
            cell.classList.add('cell-audit-invalid');
          }
        }
      });
    }
  }

  if (payload.drawTitle) {
    state.drawTitle = payload.drawTitle;
    if (DOM.drawTitleDisplay) DOM.drawTitleDisplay.textContent = payload.drawTitle;
    if (DOM.drawTitleInput) DOM.drawTitleInput.value = payload.drawTitle;
  }

  if (payload.currentTheme && payload.currentTheme !== state.currentTheme) {
    setTheme(payload.currentTheme, false);
  }

  if (typeof payload.fontScale === 'number') {
    applyFontScale(payload.fontScale, false);
  }
}

function applyExternalEvent(eventType, eventData = {}) {
  if (eventType === 'number-drawn') {
    const num = eventData.num;
    const cell = document.getElementById(`cell-${num}`);
    if (cell) {
      cell.classList.add('just-entered');
      setTimeout(() => {
        if (cell) cell.classList.remove('just-entered');
      }, 400);
    }
    if (DOM.currentNumberDisplay) {
      DOM.currentNumberDisplay.classList.remove('number-pop');
      void DOM.currentNumberDisplay.offsetWidth;
      DOM.currentNumberDisplay.classList.add('number-pop');
    }
  } else if (eventType === 'number-audited') {
    const { num, isValid, orderIndex } = eventData;
    if (!state.numerosAuditados.includes(num)) {
      state.numerosAuditados.push(num);
    }
    const cell = document.getElementById(`cell-${num}`);
    if (isValid) {
      if (cell) {
        cell.classList.remove('cell-audit-invalid');
        cell.classList.add('cell-audit-valid');
      }
      showAuditToast(true, `N° ${String(num).padStart(2, '0')} VÁLIDO`, `Fue el #${orderIndex} en salir`);
    } else {
      if (cell) {
        cell.classList.remove('cell-audit-valid');
        cell.classList.add('cell-audit-invalid');
      }
      showAuditToast(false, `N° ${String(num).padStart(2, '0')} NO SALIÓ`, `Número NO cantado en sorteo`);
    }
  } else if (eventType === 'audit-number-removed') {
    const { num } = eventData;
    state.numerosAuditados = state.numerosAuditados.filter(n => n !== num);
    const cell = document.getElementById(`cell-${num}`);
    if (cell) {
      cell.classList.remove('cell-audit-valid', 'cell-audit-invalid');
    }
    if (DOM.auditToast) {
      DOM.auditToast.style.display = 'none';
    }
  } else if (eventType === 'winner-celebration') {
    showWinnerCelebration(false);
  } else if (eventType === 'hide-winner-celebration') {
    hideWinnerCelebration(false);
  } else if (eventType === 'game-reset') {
    resetBoardUIOnly();
  }
}

function updateProjectorButtonUI(isOpen) {
  if (!DOM.btnProjectorToggle) return;
  if (isOpen) {
    DOM.btnProjectorToggle.classList.add('active');
    if (DOM.projectorBtnText) DOM.projectorBtnText.textContent = 'Cerrar 2da Pantalla';
  } else {
    DOM.btnProjectorToggle.classList.remove('active');
    if (DOM.projectorBtnText) DOM.projectorBtnText.textContent = 'Segunda Pantalla';
  }
}

// ==========================================================================
// 4. PERSISTENCIA TOTAL ANTE CRASH O CIERRE (LocalStorage)
// ==========================================================================

function saveState() {
  if (isProjectorMode) return;
  try {
    const payload = {
      numerosSalidos: state.numerosSalidos,
      drawTitle: state.drawTitle,
      currentTheme: state.currentTheme,
      fontScale: state.fontScale,
      soundPreset: state.soundPreset
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Error saving state to localStorage:', e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.numerosSalidos)) {
      state.numerosSalidos = parsed.numerosSalidos;
    }
    if (parsed.drawTitle) {
      state.drawTitle = parsed.drawTitle;
      if (DOM.drawTitleInput) DOM.drawTitleInput.value = parsed.drawTitle;
      if (DOM.drawTitleDisplay) DOM.drawTitleDisplay.textContent = parsed.drawTitle;
    }
    if (parsed.currentTheme) {
      state.currentTheme = parsed.currentTheme;
      setTheme(parsed.currentTheme, false);
    }
    if (typeof parsed.fontScale === 'number') {
      state.fontScale = Math.max(60, Math.min(130, parsed.fontScale));
      applyFontScale(state.fontScale, false);
    } else {
      applyFontScale(100, false);
    }
    if (!isProjectorMode) {
      if (parsed.soundPreset) {
        state.soundPreset = parsed.soundPreset;
      } else if (typeof parsed.soundEnabled === 'boolean') {
        state.soundPreset = parsed.soundEnabled ? 'clasico' : 'silencio';
      }
      updateSoundUI();
    }
    return true;
  } catch (e) {
    console.warn('Error loading state from localStorage:', e);
    return false;
  }
}

function clearState() {
  if (isProjectorMode) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}

function applyFontScale(val, shouldBroadcast = true) {
  state.fontScale = val;
  const factor = (val / 100).toFixed(2);
  document.documentElement.style.setProperty('--font-scale', factor);
  if (DOM.fontSizeSlider) DOM.fontSizeSlider.value = val;
  if (DOM.fontSizeValue) DOM.fontSizeValue.textContent = `${val}%`;
  if (shouldBroadcast) {
    broadcastState();
  }
}

// ==========================================================================
// 5. SINTETIZADOR DE AUDIO MULTI-PERFIL (Web Audio API)
// ==========================================================================

function getAudioContext() {
  if (isProjectorMode) return null;
  if (!state.audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      state.audioCtx = new AudioContext();
    }
  }
  if (state.audioCtx && state.audioCtx.state === 'suspended') {
    state.audioCtx.resume();
  }
  return state.audioCtx;
}

function isAudioActive() {
  return !isProjectorMode && state.soundPreset && state.soundPreset !== 'silencio';
}

function playTone(freq, type = 'sine', duration = 0.15, delay = 0, startGain = 0.2) {
  if (!isAudioActive()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    
    setTimeout(() => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(startGain, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    }, delay * 1000);
  } catch (e) {}
}

function playDrawSound() {
  if (!isAudioActive()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const preset = state.soundPreset || 'clasico';

  if (preset === 'arcade') {
    // 8-bit blip ascendente rápido
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(350, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}

  } else if (preset === 'marimba') {
    // Golpe de marimba acústica suave
    playTone(440, 'triangle', 0.18, 0, 0.25);
    playTone(880, 'sine', 0.12, 0, 0.12);

  } else if (preset === 'digital') {
    // Pop moderno de frecuencia descendente
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(450, ctx.currentTime + 0.09);
      gain.gain.setValueAtTime(0.24, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch (e) {}

  } else if (preset === 'campana') {
    // Campanilla cristalina
    playTone(1046.50, 'sine', 0.35, 0, 0.22);
    playTone(2093.00, 'sine', 0.20, 0, 0.08);

  } else {
    // Clásico / Casino (por defecto)
    playTone(523.25, 'triangle', 0.12, 0, 0.22); // C5
    playTone(659.25, 'triangle', 0.22, 0.07, 0.22); // E5
  }
}

function playAuditValidSound() {
  if (!isAudioActive()) return;
  const preset = state.soundPreset || 'clasico';

  if (preset === 'arcade') {
    // Arpegio retro power-up
    playTone(330, 'square', 0.09, 0, 0.15);
    playTone(440, 'square', 0.09, 0.07, 0.15);
    playTone(660, 'square', 0.09, 0.14, 0.15);
    playTone(880, 'square', 0.22, 0.21, 0.18);

  } else if (preset === 'marimba') {
    // Acorde de marimba suave
    playTone(392.00, 'triangle', 0.20, 0, 0.22); // G4
    playTone(523.25, 'triangle', 0.22, 0.07, 0.22); // C5
    playTone(659.25, 'triangle', 0.25, 0.14, 0.24); // E5
    playTone(783.99, 'triangle', 0.35, 0.22, 0.26); // G5

  } else if (preset === 'digital') {
    // Ding-dong digital nítido
    playTone(784, 'sine', 0.15, 0, 0.22);
    playTone(1174, 'sine', 0.30, 0.09, 0.25);

  } else if (preset === 'campana') {
    // Campanadas de cristal ascendentes
    playTone(783.99, 'sine', 0.25, 0, 0.2);
    playTone(1046.50, 'sine', 0.30, 0.10, 0.22);
    playTone(1318.51, 'sine', 0.45, 0.20, 0.25);

  } else {
    // Clásico
    playTone(523.25, 'sine', 0.15, 0, 0.2);
    playTone(659.25, 'sine', 0.15, 0.08, 0.2);
    playTone(783.99, 'sine', 0.25, 0.16, 0.22);
    playTone(1046.50, 'sine', 0.35, 0.25, 0.25);
  }
}

function playAuditInvalidSound() {
  if (!isAudioActive()) return;
  const preset = state.soundPreset || 'clasico';

  if (preset === 'arcade') {
    // Buzzer 8-bit game over
    playTone(140, 'sawtooth', 0.18, 0, 0.2);
    playTone(110, 'sawtooth', 0.28, 0.12, 0.22);

  } else if (preset === 'marimba') {
    // Golpe sordo de madera
    playTone(165, 'triangle', 0.22, 0, 0.25);
    playTone(130, 'triangle', 0.30, 0.12, 0.22);

  } else if (preset === 'digital') {
    // Doble reject digital
    playTone(280, 'square', 0.12, 0, 0.15);
    playTone(220, 'square', 0.20, 0.10, 0.15);

  } else if (preset === 'campana') {
    // Tono metálico opaco
    playTone(240, 'triangle', 0.20, 0, 0.22);
    playTone(180, 'triangle', 0.25, 0.12, 0.22);

  } else {
    // Clásico
    playTone(220, 'sawtooth', 0.22, 0, 0.2);
    playTone(175, 'sawtooth', 0.3, 0.15, 0.2);
  }
}

function playVictoryFanfare() {
  if (!isAudioActive()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    
    const preset = state.soundPreset || 'clasico';

    if (preset === 'arcade') {
      // Fanfarria victoriosa chip-tune 8-bit
      const notes = [
        { freq: 523.25, time: 0, dur: 0.10 },
        { freq: 587.33, time: 0.09, dur: 0.10 },
        { freq: 659.25, time: 0.18, dur: 0.12 },
        { freq: 783.99, time: 0.28, dur: 0.14 },
        { freq: 1046.50, time: 0.42, dur: 0.55 }
      ];
      notes.forEach(n => {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(n.freq, ctx.currentTime);
          gain.gain.setValueAtTime(0.20, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + n.dur);
        }, n.time * 1000);
      });

    } else if (preset === 'marimba') {
      // Cascada festiva de marimba
      const notes = [
        { freq: 523.25, time: 0, dur: 0.18 },
        { freq: 659.25, time: 0.10, dur: 0.20 },
        { freq: 783.99, time: 0.20, dur: 0.22 },
        { freq: 987.77, time: 0.30, dur: 0.25 },
        { freq: 1046.50, time: 0.42, dur: 0.65 }
      ];
      notes.forEach(n => {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(n.freq, ctx.currentTime);
          gain.gain.setValueAtTime(0.26, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + n.dur);
        }, n.time * 1000);
      });

    } else if (preset === 'digital' || preset === 'campana') {
      // Fanfarria brillante cristalina
      const notes = [
        { freq: 659.25, time: 0, dur: 0.15 },
        { freq: 783.99, time: 0.12, dur: 0.16 },
        { freq: 1046.50, time: 0.24, dur: 0.20 },
        { freq: 1318.51, time: 0.38, dur: 0.60 }
      ];
      notes.forEach(n => {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(n.freq, ctx.currentTime);
          gain.gain.setValueAtTime(0.28, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + n.dur);
        }, n.time * 1000);
      });

    } else {
      // Fanfarria clásica
      const notes = [
        { freq: 523.25, time: 0, dur: 0.14 },    // C5
        { freq: 659.25, time: 0.11, dur: 0.14 }, // E5
        { freq: 783.99, time: 0.22, dur: 0.18 }, // G5
        { freq: 1046.50, time: 0.36, dur: 0.65 } // C6
      ];
      notes.forEach(n => {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(n.freq, ctx.currentTime);
          gain.gain.setValueAtTime(0.28, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + n.dur);
        }, n.time * 1000);
      });
    }
  } catch (e) {}
}

function updateSoundUI() {
  if (!DOM.soundPresetSelect) return;
  DOM.soundPresetSelect.value = state.soundPreset || 'clasico';
  if (DOM.soundSelectIcon) {
    DOM.soundSelectIcon.textContent = (state.soundPreset === 'silencio') ? '🔇' : '🔊';
  }
}

// ==========================================================================
// 6. MOTOR DE CONFETI Y FUEGOS ARTIFICIALES EN CANVAS (ALTO RENDIMIENTO)
// ==========================================================================

let confettiAnimId = null;
let confettiParticles = [];
let fireworkParticles = [];

class ConfettiParticle {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.reset();
  }

  reset() {
    this.x = Math.random() * this.w;
    this.y = -20 - Math.random() * 60;
    this.size = Math.random() * 9 + 6;
    this.speedY = Math.random() * 3.8 + 2.2;
    this.speedX = Math.random() * 3 - 1.5;
    this.rotation = Math.random() * 360;
    this.rotSpeed = Math.random() * 6 - 3;
    this.colors = ['#ffd700', '#ff9900', '#00ff66', '#00d2ff', '#ff3366', '#ffffff', '#e040fb'];
    this.color = this.colors[Math.floor(Math.random() * this.colors.length)];
    this.shape = Math.random() > 0.4 ? 'rect' : 'circle';
  }

  update() {
    this.y += this.speedY;
    this.x += this.speedX + Math.sin(this.y / 30) * 0.8;
    this.rotation += this.rotSpeed;

    if (this.y > this.h + 20) {
      this.reset();
    }
  }

  draw(ctx) {
    ctx.fillStyle = this.color;
    if (this.shape === 'rect') {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate((this.rotation * Math.PI) / 180);
      ctx.fillRect(-this.size / 2, -this.size / 4, this.size, this.size / 2);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size / 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

class FireworkParticle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 6 + 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.alpha = 1;
    this.decay = Math.random() * 0.03 + 0.02;
    this.size = Math.random() * 3.5 + 2;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.08;
    this.vx *= 0.98;
    this.alpha -= this.decay;
  }

  draw(ctx) {
    if (this.alpha <= 0) return;
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function spawnRandomFirework(w, h) {
  if (fireworkParticles.length > 50) return; // Limitar total de partículas simultáneas
  const x = Math.random() * (w * 0.8) + w * 0.1;
  const y = Math.random() * (h * 0.45) + h * 0.1;
  const colors = ['#ffd700', '#00ff66', '#00e5ff', '#ff0055', '#ff9900', '#ffffff', '#e040fb'];
  const col = colors[Math.floor(Math.random() * colors.length)];
  for (let i = 0; i < 20; i++) {
    fireworkParticles.push(new FireworkParticle(x, y, col));
  }
}

function startConfetti() {
  if (!DOM.confettiCanvas) return;
  const canvas = DOM.confettiCanvas;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  confettiParticles = [];
  fireworkParticles = [];
  const count = window.innerWidth > 1000 ? 80 : 45;
  for (let i = 0; i < count; i++) {
    confettiParticles.push(new ConfettiParticle(canvas.width, canvas.height));
  }

  if (confettiAnimId) cancelAnimationFrame(confettiAnimId);

  let frameCount = 0;
  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frameCount++;

    if (frameCount % 36 === 0) {
      spawnRandomFirework(canvas.width, canvas.height);
    }

    ctx.globalAlpha = 1;
    confettiParticles.forEach(p => {
      p.update();
      p.draw(ctx);
    });

    for (let i = fireworkParticles.length - 1; i >= 0; i--) {
      const fp = fireworkParticles[i];
      fp.update();
      fp.draw(ctx);
      if (fp.alpha <= 0) {
        fireworkParticles.splice(i, 1);
      }
    }

    confettiAnimId = requestAnimationFrame(loop);
  }

  loop();
}

function stopConfetti() {
  if (confettiAnimId) {
    cancelAnimationFrame(confettiAnimId);
    confettiAnimId = null;
  }
  fireworkParticles = [];
  if (DOM.confettiCanvas) {
    const ctx = DOM.confettiCanvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, DOM.confettiCanvas.width, DOM.confettiCanvas.height);
  }
}

function showWinnerCelebration(shouldBroadcast = true) {
  if (!DOM.winnerOverlay) return;
  DOM.winnerOverlay.style.display = 'flex';
  DOM.winnerOverlay.classList.add('show');
  startConfetti();
  playVictoryFanfare();

  if (shouldBroadcast) {
    broadcastEvent('winner-celebration', {});
  }
}

function hideWinnerCelebration(shouldBroadcast = true) {
  if (!DOM.winnerOverlay) return;
  DOM.winnerOverlay.classList.remove('show');
  DOM.winnerOverlay.style.display = 'none';
  stopConfetti();

  if (shouldBroadcast) {
    broadcastEvent('hide-winner-celebration', {});
  }
  if (!isProjectorMode) {
    refocusInput();
  }
}

// ==========================================================================
// 7. INICIALIZACIÓN Y RENDERIZADO DEL TABLERO
// ==========================================================================

function initBoard() {
  if (!DOM.bingoBoard) return;
  DOM.bingoBoard.innerHTML = '';
  
  for (let i = 1; i <= 90; i++) {
    const cell = document.createElement('div');
    cell.className = 'bingo-cell';
    cell.id = `cell-${i}`;
    cell.textContent = i;
    cell.dataset.number = i;
    DOM.bingoBoard.appendChild(cell);
  }

  refreshBoardFromState();
  if (!isProjectorMode) {
    refocusInput();
  }
}

function refreshBoardFromState() {
  document.querySelectorAll('.bingo-cell').forEach(cell => {
    cell.classList.remove('active', 'last-active');
  });

  if (state.numerosSalidos.length > 0) {
    state.numerosSalidos.forEach((num, index) => {
      const cell = document.getElementById(`cell-${num}`);
      if (cell) {
        cell.classList.add('active');
        if (index === state.numerosSalidos.length - 1) {
          cell.classList.add('last-active');
        }
      }
    });
    const lastNum = state.numerosSalidos[state.numerosSalidos.length - 1];
    DOM.currentNumberDisplay.textContent = String(lastNum).padStart(2, '0');
  } else {
    DOM.currentNumberDisplay.textContent = '--';
  }

  updateStats();
  updateHistory();
}

// ==========================================================================
// 8. LÓGICA DE SORTEO Y ENTRADA DE NÚMEROS
// ==========================================================================

function handleNumberSubmit() {
  if (isProjectorMode || !DOM.numberInput) return;
  const value = parseInt(DOM.numberInput.value.trim(), 10);
  
  if (isNaN(value) || value < 1 || value > 90) {
    showInputShake(DOM.numberInput);
    DOM.numberInput.value = '';
    refocusInput();
    return;
  }

  if (state.isBingoMode) {
    auditNumber(value);
  } else {
    drawNumber(value);
  }

  DOM.numberInput.value = '';
  refocusInput();
}

function drawNumber(num) {
  if (state.numerosSalidos.includes(num)) {
    // El número ya salió: animar temporalmente y avisar
    highlightCell(num);
    playTone(320, 'sine', 0.18);
    return;
  }

  // Quitar la clase del último número anterior
  if (state.numerosSalidos.length > 0) {
    const prevLast = state.numerosSalidos[state.numerosSalidos.length - 1];
    const prevCell = document.getElementById(`cell-${prevLast}`);
    if (prevCell) {
      prevCell.classList.remove('last-active');
    }
  }

  // Registrar número
  state.numerosSalidos.push(num);

  // Activar únicamente la nueva celda
  const cell = document.getElementById(`cell-${num}`);
  if (cell) {
    cell.classList.add('active', 'last-active', 'just-entered');
    setTimeout(() => {
      if (cell) cell.classList.remove('just-entered');
    }, 400);
  }

  // Actualizar display
  DOM.currentNumberDisplay.textContent = String(num).padStart(2, '0');
  DOM.currentNumberDisplay.classList.remove('number-pop');
  void DOM.currentNumberDisplay.offsetWidth; // Forzar reflow
  DOM.currentNumberDisplay.classList.add('number-pop');

  playDrawSound();
  updateStats();
  updateHistory();
  saveState();

  // Sincronizar con la segunda pantalla
  broadcastEvent('number-drawn', { num });
  broadcastState();
}

function highlightCell(num) {
  const cell = document.getElementById(`cell-${num}`);
  if (cell) {
    cell.style.transform = 'scale(1.22)';
    setTimeout(() => {
      cell.style.transform = '';
    }, 350);
  }
}

// ==========================================================================
// 9. CORRECCIÓN DE ERRORES INLINE (SIN MODAL INTERRUPTIVO)
// ==========================================================================

function handleInlineRemoveNumber() {
  if (isProjectorMode || !DOM.removeInlineInput) return;
  const num = parseInt(DOM.removeInlineInput.value.trim(), 10);
  
  if (isNaN(num) || num < 1 || num > 90) {
    showInputShake(DOM.removeInlineInput);
    DOM.removeInlineInput.value = '';
    refocusInput();
    return;
  }

  // MODO AUDITORÍA BINGO: Quitar la marcación de auditoría (verde o roja) del número
  if (state.isBingoMode) {
    const isAudited = state.numerosAuditados.includes(num);
    const cell = document.getElementById(`cell-${num}`);
    const hasAuditClass = cell && (cell.classList.contains('cell-audit-valid') || cell.classList.contains('cell-audit-invalid'));

    if (!isAudited && !hasAuditClass) {
      showInputShake(DOM.removeInlineInput);
      playTone(180, 'sawtooth', 0.2);
      DOM.removeInlineInput.value = '';
      refocusInput();
      return;
    }

    // Quitar de la lista de auditados
    state.numerosAuditados = state.numerosAuditados.filter(n => n !== num);

    // Quitar clases de auditoría de la celda
    if (cell) {
      cell.classList.remove('cell-audit-valid', 'cell-audit-invalid');
    }

    if (DOM.auditToast) {
      DOM.auditToast.style.display = 'none';
    }

    playTone(320, 'sine', 0.12);
    DOM.removeInlineInput.value = '';
    broadcastEvent('audit-number-removed', { num });
    broadcastState();
    refocusInput();
    return;
  }

  // MODO SORTEO NORMAL: Quitar número cantado de la partida
  if (!state.numerosSalidos.includes(num)) {
    showInputShake(DOM.removeInlineInput);
    playTone(180, 'sawtooth', 0.2);
    DOM.removeInlineInput.value = '';
    refocusInput();
    return;
  }

  // Eliminar el número del array de sorteo
  state.numerosSalidos = state.numerosSalidos.filter(n => n !== num);

  // Quitar clases activas y de auditoría de la celda
  const cell = document.getElementById(`cell-${num}`);
  if (cell) {
    cell.classList.remove('active', 'last-active', 'cell-audit-valid', 'cell-audit-invalid');
  }

  // Recalcular el último número activo
  document.querySelectorAll('.bingo-cell.last-active').forEach(c => c.classList.remove('last-active'));
  
  if (state.numerosSalidos.length > 0) {
    const lastNum = state.numerosSalidos[state.numerosSalidos.length - 1];
    const lastCell = document.getElementById(`cell-${lastNum}`);
    if (lastCell) {
      lastCell.classList.add('last-active');
    }
    DOM.currentNumberDisplay.textContent = String(lastNum).padStart(2, '0');
  } else {
    DOM.currentNumberDisplay.textContent = '--';
  }

  DOM.removeInlineInput.value = '';
  updateStats();
  updateHistory();
  saveState();
  broadcastState();
  refocusInput();
}

function undoLastNumber() {
  if (isProjectorMode) return;

  // MODO AUDITORÍA BINGO: Deshacer el último número auditado (verde o rojo)
  if (state.isBingoMode) {
    let removedAuditNum = null;

    if (state.numerosAuditados && state.numerosAuditados.length > 0) {
      removedAuditNum = state.numerosAuditados.pop();
    } else {
      // Fallback: Buscar en el DOM si hay alguna celda con clase de auditoría
      const auditedCells = Array.from(document.querySelectorAll('.cell-audit-valid, .cell-audit-invalid'));
      if (auditedCells.length > 0) {
        const lastCell = auditedCells[auditedCells.length - 1];
        removedAuditNum = parseInt(lastCell.dataset.number, 10);
      }
    }

    if (removedAuditNum === null || isNaN(removedAuditNum)) return;

    const cell = document.getElementById(`cell-${removedAuditNum}`);
    if (cell) {
      cell.classList.remove('cell-audit-valid', 'cell-audit-invalid');
    }

    if (DOM.auditToast) {
      DOM.auditToast.style.display = 'none';
    }

    playTone(320, 'sine', 0.12);
    broadcastEvent('audit-number-removed', { num: removedAuditNum });
    broadcastState();
    refocusInput();
    return;
  }

  // MODO SORTEO NORMAL: Deshacer el último número cantado
  if (state.numerosSalidos.length === 0) return;

  const removedNum = state.numerosSalidos.pop();
  const cell = document.getElementById(`cell-${removedNum}`);
  if (cell) {
    cell.classList.remove('active', 'last-active', 'cell-audit-valid', 'cell-audit-invalid');
  }

  if (state.numerosSalidos.length > 0) {
    const newLast = state.numerosSalidos[state.numerosSalidos.length - 1];
    const lastCell = document.getElementById(`cell-${newLast}`);
    if (lastCell) {
      lastCell.classList.add('last-active');
    }
    DOM.currentNumberDisplay.textContent = String(newLast).padStart(2, '0');
  } else {
    DOM.currentNumberDisplay.textContent = '--';
  }

  updateStats();
  updateHistory();
  saveState();
  broadcastState();
  refocusInput();
}

// ==========================================================================
// 10. MODO BINGO (AUDITORÍA PERSISTENTE CON ZOOM VERDE / ROJO)
// ==========================================================================

function toggleBingoMode() {
  if (isProjectorMode) return;
  state.isBingoMode = !state.isBingoMode;

  if (state.isBingoMode) {
    state.numerosAuditados = [];
    if (DOM.btnBingoToggle) {
      DOM.btnBingoToggle.classList.add('active');
      DOM.btnBingoToggle.setAttribute('aria-pressed', 'true');
      DOM.bingoStatusText.textContent = '● AUDITORÍA';
    }
    if (DOM.btnWinnerCelebration) {
      DOM.btnWinnerCelebration.disabled = false;
    }
    if (DOM.auditStatusBadge) DOM.auditStatusBadge.style.display = 'flex';
    if (DOM.inputLabel) DOM.inputLabel.textContent = 'AUDITAR N°';
    if (DOM.inputHint) DOM.inputHint.textContent = 'Ingrese N° para auditar en cartón';
    if (DOM.numberInput) DOM.numberInput.placeholder = '??';
    if (DOM.btnUndo) {
      DOM.btnUndo.textContent = '↺ Deshacer Auditado';
      DOM.btnUndo.title = 'Deshacer último número auditado (Ctrl+Z)';
    }
    if (DOM.btnRemoveInline) {
      DOM.btnRemoveInline.title = 'Quitar marcación de auditoría de este número';
    }
  } else {
    state.numerosAuditados = [];
    if (DOM.btnBingoToggle) {
      DOM.btnBingoToggle.classList.remove('active');
      DOM.btnBingoToggle.setAttribute('aria-pressed', 'false');
      DOM.bingoStatusText.textContent = 'SORTEO';
    }
    if (DOM.btnWinnerCelebration) {
      DOM.btnWinnerCelebration.disabled = true;
    }
    if (DOM.auditStatusBadge) DOM.auditStatusBadge.style.display = 'none';
    if (DOM.inputLabel) DOM.inputLabel.textContent = 'NÚMERO (1-90)';
    if (DOM.inputHint) DOM.inputHint.textContent = 'Presione [Enter]';
    if (DOM.numberInput) DOM.numberInput.placeholder = '00';
    if (DOM.auditToast) DOM.auditToast.style.display = 'none';
    if (DOM.btnUndo) {
      DOM.btnUndo.textContent = '↺ Deshacer Último';
      DOM.btnUndo.title = 'Deshacer el último número ingresado (Ctrl+Z)';
    }
    if (DOM.btnRemoveInline) {
      DOM.btnRemoveInline.title = 'Quitar este número del sorteo';
    }

    document.querySelectorAll('.cell-audit-valid, .cell-audit-invalid').forEach(c => {
      c.classList.remove('cell-audit-valid', 'cell-audit-invalid');
    });

    hideWinnerCelebration(true);
  }

  broadcastState();
  refocusInput();
}

function auditNumber(num) {
  const exists = state.numerosSalidos.includes(num);
  const cell = document.getElementById(`cell-${num}`);
  let orderIndex = 0;

  // Registrar en el orden cronológico de auditoría (para poder deshacerlo en orden)
  state.numerosAuditados = state.numerosAuditados.filter(n => n !== num);
  state.numerosAuditados.push(num);

  if (exists) {
    orderIndex = state.numerosSalidos.indexOf(num) + 1;
    
    if (cell) {
      cell.classList.remove('cell-audit-invalid');
      cell.classList.add('cell-audit-valid');
    }

    showAuditToast(true, `N° ${String(num).padStart(2, '0')} VÁLIDO`, `Fue el #${orderIndex} en salir`);
    playAuditValidSound();

  } else {
    if (cell) {
      cell.classList.remove('cell-audit-valid');
      cell.classList.add('cell-audit-invalid');
    }

    showAuditToast(false, `N° ${String(num).padStart(2, '0')} NO SALIÓ`, `Número NO cantado en sorteo`);
    playAuditInvalidSound();
  }

  broadcastEvent('number-audited', { num, isValid: exists, orderIndex });
  broadcastState();
}

function showAuditToast(isValid, title, desc) {
  if (!DOM.auditToast) return;
  DOM.auditToast.style.display = 'flex';
  DOM.auditToast.className = `audit-toast ${isValid ? 'valid' : 'invalid'}`;
  DOM.auditToastIcon.textContent = isValid ? '✅' : '❌';
  DOM.auditToastTitle.textContent = title;
  DOM.auditToastDesc.textContent = desc;

  clearTimeout(showAuditToast._timeout);
  showAuditToast._timeout = setTimeout(() => {
    if (DOM.auditToast) DOM.auditToast.style.display = 'none';
  }, 4000);
}

// ==========================================================================
// 11. GESTIÓN DE TEMAS, PANTALLA COMPLETA & SEGUNDA PANTALLA
// ==========================================================================

function setTheme(themeName, shouldBroadcast = true) {
  state.currentTheme = themeName;
  document.documentElement.setAttribute('data-theme', themeName);
  document.body.className = `${isProjectorMode ? 'projector-mode ' : ''}theme-${themeName}`;

  if (DOM.themeButtons) {
    DOM.themeButtons.forEach(btn => {
      if (btn.dataset.theme === themeName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  saveState();
  if (shouldBroadcast) {
    broadcastState();
  }
}

async function toggleFullScreen() {
  if (window.electronAPI && window.electronAPI.toggleFullScreen) {
    await window.electronAPI.toggleFullScreen();
  } else {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
}

async function toggleProjector() {
  if (window.electronAPI && window.electronAPI.toggleProjector) {
    const isOpen = await window.electronAPI.toggleProjector();
    updateProjectorButtonUI(isOpen);
  }
}

function updateFullscreenButton(isFull) {
  if (!DOM.fullscreenText) return;
  if (isFull) {
    DOM.fullscreenText.textContent = 'Salir Fullscreen';
  } else {
    DOM.fullscreenText.textContent = 'Pantalla Completa';
  }
}

if (window.electronAPI && window.electronAPI.onFullScreenChange) {
  window.electronAPI.onFullScreenChange(updateFullscreenButton);
} else {
  document.addEventListener('fullscreenchange', () => {
    updateFullscreenButton(!!document.fullscreenElement);
  });
}

function updateSoundButtonUI() {
  updateSoundUI();
}

// ==========================================================================
// 12. ACTUALIZADOR DESDE GITHUB RELEASES
// ==========================================================================

async function checkAppUpdates(isManual = false) {
  if (!window.electronAPI || !window.electronAPI.checkForUpdates) {
    if (isManual) alert('Actualizador no disponible en este entorno.');
    return;
  }

  if (isManual) {
    DOM.updateModalOverlay.classList.add('show');
    DOM.updateModalIcon.textContent = '🔄';
    DOM.updateModalTitle.textContent = 'Comprobando actualizaciones...';
    DOM.updateModalDesc.textContent = 'Consultando el repositorio de BingHo en GitHub...';
    if (DOM.updateNotesBox) DOM.updateNotesBox.style.display = 'none';
    if (DOM.updateProgressContainer) DOM.updateProgressContainer.style.display = 'none';
    if (DOM.btnDownloadUpdate) DOM.btnDownloadUpdate.style.display = 'none';
    if (DOM.btnManualDownload) DOM.btnManualDownload.style.display = 'none';
    if (DOM.btnCancelUpdate) {
      DOM.btnCancelUpdate.disabled = false;
      DOM.btnCancelUpdate.textContent = 'Cerrar';
    }
  }

  try {
    const res = await window.electronAPI.checkForUpdates();
    if (res.success) {
      if (res.hasUpdate) {
        updateDownloadUrl = res.downloadUrl || res.releaseUrl;
        updateReleasePageUrl = res.releaseUrl || res.downloadUrl;
        
        DOM.updateModalOverlay.classList.add('show');
        DOM.updateModalIcon.textContent = '🚀';
        DOM.updateModalTitle.innerHTML = `¡Nueva Versión Disponible! <span class="update-badge-new">${res.latestTag}</span>`;
        const currentDisplay = `v${res.currentVersion}${res.currentBuild ? ` (Build ${res.currentBuild})` : ''}`;
        DOM.updateModalDesc.innerHTML = `Tienes instalada la versión <b>${currentDisplay}</b> y la versión <b>${res.latestTag}</b> ya está disponible para instalar.`;
        
        if (DOM.updateNotesBox && res.releaseNotes) {
          DOM.updateNotesBox.textContent = res.releaseNotes;
          DOM.updateNotesBox.style.display = 'block';
        }
        
        if (DOM.updateProgressContainer) {
          DOM.updateProgressContainer.style.display = 'none';
        }
        if (DOM.updateProgressBar) {
          DOM.updateProgressBar.style.width = '0%';
        }
        
        if (DOM.btnDownloadUpdate) {
          DOM.btnDownloadUpdate.style.display = 'inline-block';
          DOM.btnDownloadUpdate.disabled = false;
          DOM.btnDownloadUpdate.textContent = '⚡ Actualizar y Reiniciar';
        }
        if (DOM.btnManualDownload) {
          DOM.btnManualDownload.style.display = 'inline-block';
        }
        if (DOM.btnCancelUpdate) {
          DOM.btnCancelUpdate.disabled = false;
        }

        if (DOM.updateBtnText) {
          DOM.updateBtnText.textContent = `Actualizar (${res.latestTag})`;
          DOM.btnCheckUpdates.classList.add('active');
        }
      } else if (isManual) {
        const currentDisplay = `v${res.currentVersion}${res.currentBuild ? ` (Build ${res.currentBuild})` : ''}`;
        DOM.updateModalIcon.textContent = '✅';
        DOM.updateModalTitle.textContent = '¡Tienes la última versión!';
        DOM.updateModalDesc.innerHTML = `Estás ejecutando <b>${currentDisplay}</b>, que es la versión más reciente disponible.`;
        if (DOM.updateNotesBox) DOM.updateNotesBox.style.display = 'none';
        if (DOM.updateProgressContainer) DOM.updateProgressContainer.style.display = 'none';
        if (DOM.btnDownloadUpdate) DOM.btnDownloadUpdate.style.display = 'none';
        if (DOM.btnManualDownload) DOM.btnManualDownload.style.display = 'none';
      }
    } else if (isManual) {
      DOM.updateModalIcon.textContent = '⚠️';
      DOM.updateModalTitle.textContent = 'No se pudo comprobar';
      DOM.updateModalDesc.textContent = `Error al conectar con GitHub: ${res.error || 'Verifica tu conexión a internet.'}`;
      if (DOM.updateNotesBox) DOM.updateNotesBox.style.display = 'none';
      if (DOM.updateProgressContainer) DOM.updateProgressContainer.style.display = 'none';
      if (DOM.btnDownloadUpdate) DOM.btnDownloadUpdate.style.display = 'none';
      if (DOM.btnManualDownload) DOM.btnManualDownload.style.display = 'none';
    }
  } catch (e) {
    if (isManual) {
      DOM.updateModalIcon.textContent = '⚠️';
      DOM.updateModalTitle.textContent = 'Error';
      DOM.updateModalDesc.textContent = 'Ocurrió un error al buscar actualizaciones.';
      if (DOM.updateNotesBox) DOM.updateNotesBox.style.display = 'none';
      if (DOM.updateProgressContainer) DOM.updateProgressContainer.style.display = 'none';
      if (DOM.btnDownloadUpdate) DOM.btnDownloadUpdate.style.display = 'none';
      if (DOM.btnManualDownload) DOM.btnManualDownload.style.display = 'none';
    }
  }
}

// ==========================================================================
// 13. REINICIO DE SORTEO (NUEVO SORTEO)
// ==========================================================================

function showResetConfirmation() {
  if (isProjectorMode) return;
  DOM.confirmModalOverlay.classList.add('show');
}

function hideResetConfirmation() {
  if (isProjectorMode) return;
  DOM.confirmModalOverlay.classList.remove('show');
  refocusInput();
}

function resetBoardUIOnly() {
  document.querySelectorAll('.bingo-cell').forEach(cell => {
    cell.classList.remove('active', 'last-active', 'cell-audit-valid', 'cell-audit-invalid');
  });
  DOM.currentNumberDisplay.textContent = '--';
  if (DOM.auditToast) DOM.auditToast.style.display = 'none';
  if (DOM.auditStatusBadge) DOM.auditStatusBadge.style.display = 'none';
  hideWinnerCelebration(false);
  updateStats();
  updateHistory();
}

function resetGame() {
  if (isProjectorMode) return;
  state.numerosSalidos = [];
  
  resetBoardUIOnly();

  if (DOM.numberInput) DOM.numberInput.value = '';
  if (DOM.removeInlineInput) DOM.removeInlineInput.value = '';

  if (state.isBingoMode) {
    toggleBingoMode();
  }

  clearState();
  saveState();
  broadcastEvent('game-reset', {});
  broadcastState();
  hideResetConfirmation();
  refocusInput();
}

// ==========================================================================
// 14. ACTUALIZACIÓN DE ESTADÍSTICAS E HISTORIAL
// ==========================================================================

function updateStats() {
  const count = state.numerosSalidos.length;
  if (DOM.statCounter) {
    DOM.statCounter.textContent = `${count} / 90`;
  }
}

function updateHistory() {
  if (!DOM.historyChips) return;
  if (state.numerosSalidos.length === 0) {
    DOM.historyChips.innerHTML = '<span class="history-empty">Esperando sorteo...</span>';
    return;
  }

  const recent = [...state.numerosSalidos].slice(-10).reverse();
  DOM.historyChips.innerHTML = '';

  recent.forEach((num, index) => {
    const chip = document.createElement('div');
    chip.className = `chip-number-full ${index === 0 ? 'chip-latest' : ''}`;
    chip.textContent = String(num).padStart(2, '0');
    DOM.historyChips.appendChild(chip);
  });
}

function refocusInput() {
  if (isProjectorMode) return;
  setTimeout(() => {
    if (
      DOM.confirmModalOverlay && !DOM.confirmModalOverlay.classList.contains('show') &&
      DOM.winnerOverlay && !DOM.winnerOverlay.classList.contains('show') &&
      DOM.updateModalOverlay && !DOM.updateModalOverlay.classList.contains('show') &&
      DOM.numberInput
    ) {
      DOM.numberInput.focus();
    }
  }, 40);
}

function showInputShake(element) {
  if (!element) return;
  element.style.borderColor = '#ff4d4f';
  element.style.boxShadow = '0 0 12px rgba(255, 77, 79, 0.8)';
  setTimeout(() => {
    element.style.borderColor = '';
    element.style.boxShadow = '';
  }, 400);
}

// ==========================================================================
// 15. EVENT LISTENERS
// ==========================================================================

if (!isProjectorMode) {
  // Enviar número con Enter o botón
  if (DOM.btnSubmitNumber) DOM.btnSubmitNumber.addEventListener('click', handleNumberSubmit);
  if (DOM.numberInput) {
    DOM.numberInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleNumberSubmit();
      }
    });
  }

  // Slider de Tamaño de Fuente (60% a 130%)
  if (DOM.fontSizeSlider) {
    DOM.fontSizeSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10) || 100;
      applyFontScale(val);
      saveState();
    });
  }

  // Título del sorteo
  if (DOM.drawTitleInput) {
    DOM.drawTitleInput.addEventListener('input', (e) => {
      const val = e.target.value.toUpperCase();
      state.drawTitle = val || 'SORTEO N° 001';
      DOM.drawTitleDisplay.textContent = state.drawTitle;
      saveState();
      broadcastState();
    });
  }

  // Quitar número inline
  if (DOM.btnRemoveInline) DOM.btnRemoveInline.addEventListener('click', handleInlineRemoveNumber);
  if (DOM.removeInlineInput) {
    DOM.removeInlineInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleInlineRemoveNumber();
      }
    });
  }

  // Deshacer último número
  if (DOM.btnUndo) DOM.btnUndo.addEventListener('click', undoLastNumber);

  // Toggle BINGO!
  if (DOM.btnBingoToggle) DOM.btnBingoToggle.addEventListener('click', toggleBingoMode);

  // Botón ¡CARTÓN GANADOR!
  if (DOM.btnWinnerCelebration) {
    DOM.btnWinnerCelebration.addEventListener('click', () => {
      if (state.isBingoMode) {
        showWinnerCelebration(true);
      }
    });
  }

  // Selector de Temas
  if (DOM.themeButtons) {
    DOM.themeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        setTheme(btn.dataset.theme);
        refocusInput();
      });
    });
  }

  // Botón Segunda Pantalla (Proyector)
  if (DOM.btnProjectorToggle) {
    DOM.btnProjectorToggle.addEventListener('click', toggleProjector);
  }

  // Botón Buscar Actualizaciones
  if (DOM.btnCheckUpdates) {
    DOM.btnCheckUpdates.addEventListener('click', () => checkAppUpdates(true));
  }

  // Modal de Actualizaciones
  if (DOM.btnCancelUpdate) {
    DOM.btnCancelUpdate.addEventListener('click', () => {
      DOM.updateModalOverlay.classList.remove('show');
      refocusInput();
    });
  }

  // Enlace a Donación de Cafecito
  if (DOM.btnDonationCafecito) {
    DOM.btnDonationCafecito.addEventListener('click', (e) => {
      e.preventDefault();
      const cafecitoUrl = 'https://cafecito.app/henu_45';
      if (window.electronAPI && window.electronAPI.openExternalUrl) {
        window.electronAPI.openExternalUrl(cafecitoUrl);
      } else {
        window.open(cafecitoUrl, '_blank');
      }
    });
  }

  // Descarga Manual en Navegador
  if (DOM.btnManualDownload) {
    DOM.btnManualDownload.addEventListener('click', () => {
      const url = updateReleasePageUrl || updateDownloadUrl;
      if (url && window.electronAPI && window.electronAPI.openExternalUrl) {
        window.electronAPI.openExternalUrl(url);
      }
    });
  }

  // Descarga e Instalación Automática In-App
  if (DOM.btnDownloadUpdate) {
    DOM.btnDownloadUpdate.addEventListener('click', async () => {
      if (!updateDownloadUrl) return;

      if (!window.electronAPI || !window.electronAPI.downloadAndInstallUpdate) {
        // Fallback a navegador
        if (window.electronAPI && window.electronAPI.openExternalUrl) {
          window.electronAPI.openExternalUrl(updateDownloadUrl);
        }
        return;
      }

      // Preparar UI de descarga
      if (DOM.updateProgressContainer) DOM.updateProgressContainer.style.display = 'block';
      if (DOM.updateProgressBar) DOM.updateProgressBar.style.width = '0%';
      if (DOM.updateProgressText) DOM.updateProgressText.textContent = 'Iniciando descarga...';
      if (DOM.updateProgressSize) DOM.updateProgressSize.textContent = 'Conectando...';
      
      DOM.btnDownloadUpdate.disabled = true;
      DOM.btnDownloadUpdate.textContent = '⏳ Descargando...';
      if (DOM.btnCancelUpdate) DOM.btnCancelUpdate.disabled = true;
      if (DOM.btnManualDownload) DOM.btnManualDownload.style.display = 'none';

      try {
        const result = await window.electronAPI.downloadAndInstallUpdate(updateDownloadUrl);
        if (result.success) {
          if (DOM.updateProgressBar) DOM.updateProgressBar.style.width = '100%';
          if (DOM.updateProgressText) DOM.updateProgressText.textContent = '✅ ¡Descarga completada con éxito!';
          if (DOM.updateModalDesc) {
            DOM.updateModalDesc.innerHTML = '<b>Aplicando actualización y reiniciando BingHo automáticamente...</b>';
          }
          DOM.btnDownloadUpdate.textContent = '🔄 Reiniciando...';
        } else {
          if (DOM.updateModalDesc) {
            DOM.updateModalDesc.textContent = `Error al actualizar: ${result.error || 'Error desconocido'}`;
          }
          DOM.btnDownloadUpdate.disabled = false;
          DOM.btnDownloadUpdate.textContent = 'Reintentar Actualización';
          if (DOM.btnCancelUpdate) DOM.btnCancelUpdate.disabled = false;
          if (DOM.btnManualDownload) DOM.btnManualDownload.style.display = 'inline-block';
        }
      } catch (err) {
        if (DOM.updateModalDesc) {
          DOM.updateModalDesc.textContent = `Error: ${err.message}`;
        }
        DOM.btnDownloadUpdate.disabled = false;
        DOM.btnDownloadUpdate.textContent = 'Reintentar Actualización';
        if (DOM.btnCancelUpdate) DOM.btnCancelUpdate.disabled = false;
        if (DOM.btnManualDownload) DOM.btnManualDownload.style.display = 'inline-block';
      }
    });
  }

  // Listener de progreso de descarga en tiempo real
  if (window.electronAPI && window.electronAPI.onUpdateDownloadProgress) {
    window.electronAPI.onUpdateDownloadProgress((data) => {
      if (DOM.updateProgressBar) {
        DOM.updateProgressBar.style.width = `${data.percent}%`;
      }
      if (DOM.updateProgressText) {
        DOM.updateProgressText.textContent = `Descargando actualización: ${data.percent}%`;
      }
      if (DOM.updateProgressSize) {
        DOM.updateProgressSize.textContent = `${data.downloadedMB} MB / ${data.totalMB} MB`;
      }
    });
  }

  // Pantalla Completa
  if (DOM.btnFullscreen) DOM.btnFullscreen.addEventListener('click', toggleFullScreen);

  // Selector de Efectos de Sonido
  if (DOM.soundPresetSelect) {
    DOM.soundPresetSelect.addEventListener('change', (e) => {
      state.soundPreset = e.target.value;
      updateSoundUI();
      saveState();
      if (state.soundPreset !== 'silencio') {
        playDrawSound(); // Sonido de muestra inmediato para feedback acústico
      }
      refocusInput();
    });
  }

  // Reinicio de Sorteo
  if (DOM.btnReset) DOM.btnReset.addEventListener('click', showResetConfirmation);
  if (DOM.btnCancelReset) DOM.btnCancelReset.addEventListener('click', hideResetConfirmation);
  if (DOM.btnConfirmReset) DOM.btnConfirmReset.addEventListener('click', resetGame);
}

// Botón de cerrar overlay de ganador (tanto en operador como en proyector)
if (DOM.btnCloseWinner) {
  DOM.btnCloseWinner.addEventListener('click', () => hideWinnerCelebration(true));
}
if (DOM.winnerOverlay) {
  DOM.winnerOverlay.addEventListener('click', (e) => {
    if (e.target === DOM.winnerOverlay || e.target === DOM.confettiCanvas) {
      hideWinnerCelebration(true);
    }
  });
}

// Redimensionar canvas de confeti al cambiar tamaño de ventana
window.addEventListener('resize', () => {
  if (DOM.confettiCanvas && DOM.winnerOverlay.classList.contains('show')) {
    DOM.confettiCanvas.width = window.innerWidth;
    DOM.confettiCanvas.height = window.innerHeight;
  }
});

// Atajos Globales de Teclado
window.addEventListener('keydown', (e) => {
  if (e.key === 'F11') {
    e.preventDefault();
    toggleFullScreen();
  }

  if (e.key === 'F10' && !isProjectorMode) {
    e.preventDefault();
    toggleProjector();
  }
  
  if (e.key === 'Escape') {
    if (DOM.winnerOverlay && DOM.winnerOverlay.classList.contains('show')) {
      hideWinnerCelebration(true);
      return;
    }
    if (DOM.confirmModalOverlay && DOM.confirmModalOverlay.classList.contains('show')) {
      hideResetConfirmation();
      return;
    }
    if (DOM.updateModalOverlay && DOM.updateModalOverlay.classList.contains('show')) {
      DOM.updateModalOverlay.classList.remove('show');
      refocusInput();
      return;
    }
  }

  // Ctrl+Z o Cmd+Z para deshacer último número (en Sorteo o en Auditoría)
  if (!isProjectorMode && (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
    e.preventDefault();
    undoLastNumber();
  }

  // Ctrl+B o Alt+B para alternar modo BINGO
  if (!isProjectorMode && (e.ctrlKey || e.altKey) && (e.key === 'b' || e.key === 'B')) {
    e.preventDefault();
    toggleBingoMode();
  }

  // Ctrl+W o Alt+W para festejo de cartón ganador (solo si está en modo auditoría)
  if (!isProjectorMode && (e.ctrlKey || e.altKey) && (e.key === 'w' || e.key === 'W')) {
    if (state.isBingoMode) {
      e.preventDefault();
      showWinnerCelebration(true);
    }
  }
});

// ==========================================================================
// 16. INICIO Y ESCUCHA DE SINCRONIZACIÓN
// ==========================================================================

window.addEventListener('DOMContentLoaded', () => {
  if (isProjectorMode) {
    document.body.classList.add('projector-mode');
    document.title = 'BingHo v0.9.7-beta - Pantalla de Proyección';
  } else {
    document.title = 'BingHo v0.9.7-beta - Por Hernán Cussit';
  }

  // Cargar versión y créditos dinámicamente desde el backend si está disponible
  if (window.electronAPI && window.electronAPI.getAppInfo) {
    window.electronAPI.getAppInfo().then(info => {
      if (info && info.version) {
        const display = info.displayVersion || `v${info.version}`;
        const titleStr = isProjectorMode 
          ? `BingHo ${display} - Pantalla de Proyección` 
          : `BingHo ${display} - Por ${info.author || 'Hernán Cussit'}`;
        document.title = titleStr;
        if (DOM.leftBarVersionBadge) DOM.leftBarVersionBadge.textContent = display;
        if (DOM.appVersionBadge) DOM.appVersionBadge.textContent = display;
        if (DOM.footerVersionText) DOM.footerVersionText.textContent = display;
      }
    }).catch(() => {});
  }

  loadState();
  initBoard();

  // Configurar listeners de sincronización IPC
  if (window.electronAPI) {
    if (window.electronAPI.onStateSync) {
      window.electronAPI.onStateSync((payload) => applyExternalState(payload));
    }
    if (window.electronAPI.onEventSync) {
      window.electronAPI.onEventSync((evt) => applyExternalEvent(evt.eventType, evt.eventData));
    }
    if (!isProjectorMode && window.electronAPI.onProjectorStatusChange) {
      window.electronAPI.onProjectorStatusChange((isOpen) => updateProjectorButtonUI(isOpen));
      if (window.electronAPI.isProjectorOpen) {
        window.electronAPI.isProjectorOpen().then(updateProjectorButtonUI);
      }
    }
  }

  // Configurar listeners de sincronización BroadcastChannel
  if (syncChannel) {
    syncChannel.onmessage = (e) => {
      const msg = e.data;
      if (!msg) return;
      if (msg.type === 'state-sync') {
        applyExternalState(msg.payload);
      } else if (msg.type === 'event-sync') {
        applyExternalEvent(msg.eventType, msg.eventData || msg.data);
      }
    };
  }

  // Comprobar actualizaciones silenciosamente al inicio en modo operador
  if (!isProjectorMode) {
    setTimeout(() => {
      checkAppUpdates(false);
    }, 2500);

    const unlockAudio = () => {
      getAudioContext();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
  }
});


