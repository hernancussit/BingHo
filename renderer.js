/**
 * BingHo - RENDERER & STATE LOGIC
 * Modo Doble Pantalla (Operador + Proyector Maximizado en Pantalla Extendida),
 * Persistencia Total (Anti-Crash), Modo Auditoría con Zoom Verde/Rojo,
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
  isBingoMode: false, // false: Modo Sorteo | true: Modo Bingo (Auditoría)
  drawTitle: 'SORTEO N° 001',
  currentTheme: 'clasico',
  fontScale: 100, // Escala de fuente (60 a 130)
  soundEnabled: !isProjectorMode,
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
  btnFullscreen: document.getElementById('btnFullscreen'),
  fullscreenText: document.getElementById('fullscreenText'),
  btnSoundToggle: document.getElementById('btnSoundToggle'),
  soundIcon: document.getElementById('soundIcon'),
  soundText: document.getElementById('soundText'),
  btnReset: document.getElementById('btnReset'),
  themeButtons: document.querySelectorAll('.btn-theme-chip'),

  // Modal de Confirmación de Nuevo Sorteo
  confirmModalOverlay: document.getElementById('confirmModalOverlay'),
  btnCancelReset: document.getElementById('btnCancelReset'),
  btnConfirmReset: document.getElementById('btnConfirmReset')
};

// ==========================================================================
// 3. SINCRONIZACIÓN OPERADOR <-> PROYECTOR
// ==========================================================================

function broadcastState() {
  if (isProjectorMode) return;
  const payload = {
    numerosSalidos: state.numerosSalidos,
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
    if (!state.isBingoMode) {
      document.querySelectorAll('.cell-audit-valid, .cell-audit-invalid').forEach(c => {
        c.classList.remove('cell-audit-valid', 'cell-audit-invalid');
      });
      if (DOM.auditToast) DOM.auditToast.style.display = 'none';
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
      soundEnabled: state.soundEnabled
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
    if (typeof parsed.soundEnabled === 'boolean' && !isProjectorMode) {
      state.soundEnabled = parsed.soundEnabled;
      updateSoundButtonUI();
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
// 5. SINTETIZADOR DE AUDIO (Web Audio API)
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

function playTone(freq, type = 'sine', duration = 0.15, delay = 0) {
  if (isProjectorMode || !state.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    
    setTimeout(() => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    }, delay * 1000);
  } catch (e) {}
}

function playDrawSound() {
  playTone(523.25, 'triangle', 0.12, 0); // C5
  playTone(659.25, 'triangle', 0.22, 0.07); // E5
}

function playAuditValidSound() {
  playTone(523.25, 'sine', 0.15, 0);
  playTone(659.25, 'sine', 0.15, 0.08);
  playTone(783.99, 'sine', 0.25, 0.16);
  playTone(1046.50, 'sine', 0.35, 0.25);
}

function playAuditInvalidSound() {
  playTone(220, 'sawtooth', 0.22, 0);
  playTone(175, 'sawtooth', 0.3, 0.15);
}

// ==========================================================================
// 6. INICIALIZACIÓN Y RENDERIZADO DEL TABLERO
// ==========================================================================

function initBoard() {
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
// 7. LÓGICA DE SORTEO Y ENTRADA DE NÚMEROS
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
// 8. CORRECCIÓN DE ERRORES INLINE (SIN MODAL INTERRUPTIVO)
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

  if (!state.numerosSalidos.includes(num)) {
    showInputShake(DOM.removeInlineInput);
    playTone(180, 'sawtooth', 0.2);
    DOM.removeInlineInput.value = '';
    refocusInput();
    return;
  }

  // Eliminar el número del array
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
  if (isProjectorMode || state.numerosSalidos.length === 0) return;

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
// 9. MODO BINGO (AUDITORÍA PERSISTENTE CON ZOOM VERDE / ROJO)
// ==========================================================================

function toggleBingoMode() {
  if (isProjectorMode) return;
  state.isBingoMode = !state.isBingoMode;

  if (state.isBingoMode) {
    if (DOM.btnBingoToggle) {
      DOM.btnBingoToggle.classList.add('active');
      DOM.btnBingoToggle.setAttribute('aria-pressed', 'true');
      DOM.bingoStatusText.textContent = '● AUDITORÍA';
    }
    if (DOM.auditStatusBadge) DOM.auditStatusBadge.style.display = 'flex';
    if (DOM.inputLabel) DOM.inputLabel.textContent = 'AUDITAR N°';
    if (DOM.inputHint) DOM.inputHint.textContent = 'Ingrese N° para auditar en cartón';
    if (DOM.numberInput) DOM.numberInput.placeholder = '??';
  } else {
    if (DOM.btnBingoToggle) {
      DOM.btnBingoToggle.classList.remove('active');
      DOM.btnBingoToggle.setAttribute('aria-pressed', 'false');
      DOM.bingoStatusText.textContent = 'SORTEO';
    }
    if (DOM.auditStatusBadge) DOM.auditStatusBadge.style.display = 'none';
    if (DOM.inputLabel) DOM.inputLabel.textContent = 'NÚMERO (1-90)';
    if (DOM.inputHint) DOM.inputHint.textContent = 'Presione [Enter]';
    if (DOM.numberInput) DOM.numberInput.placeholder = '00';
    if (DOM.auditToast) DOM.auditToast.style.display = 'none';

    document.querySelectorAll('.cell-audit-valid, .cell-audit-invalid').forEach(c => {
      c.classList.remove('cell-audit-valid', 'cell-audit-invalid');
    });
  }

  broadcastState();
  refocusInput();
}

function auditNumber(num) {
  const exists = state.numerosSalidos.includes(num);
  const cell = document.getElementById(`cell-${num}`);
  let orderIndex = 0;

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
// 10. GESTIÓN DE TEMAS, PANTALLA COMPLETA & SEGUNDA PANTALLA
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
  if (!DOM.soundIcon || !DOM.soundText) return;
  DOM.soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
  DOM.soundText.textContent = state.soundEnabled ? 'Sonido: ON' : 'Sonido: OFF';
}

// ==========================================================================
// 11. REINICIO DE SORTEO (NUEVO SORTEO)
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
// 12. ACTUALIZACIÓN DE ESTADÍSTICAS E HISTORIAL
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
    if (DOM.confirmModalOverlay && !DOM.confirmModalOverlay.classList.contains('show') && DOM.numberInput) {
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
// 13. EVENT LISTENERS
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

  // Pantalla Completa
  if (DOM.btnFullscreen) DOM.btnFullscreen.addEventListener('click', toggleFullScreen);

  // Sonido
  if (DOM.btnSoundToggle) {
    DOM.btnSoundToggle.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      updateSoundButtonUI();
      saveState();
      refocusInput();
    });
  }

  // Reinicio de Sorteo
  if (DOM.btnReset) DOM.btnReset.addEventListener('click', showResetConfirmation);
  if (DOM.btnCancelReset) DOM.btnCancelReset.addEventListener('click', hideResetConfirmation);
  if (DOM.btnConfirmReset) DOM.btnConfirmReset.addEventListener('click', resetGame);
}

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
    if (DOM.confirmModalOverlay && DOM.confirmModalOverlay.classList.contains('show')) {
      hideResetConfirmation();
    }
  }

  // Ctrl+B o Alt+B para alternar modo BINGO
  if (!isProjectorMode && (e.ctrlKey || e.altKey) && (e.key === 'b' || e.key === 'B')) {
    e.preventDefault();
    toggleBingoMode();
  }
});

// ==========================================================================
// 14. INICIO Y ESCUCHA DE SINCRONIZACIÓN
// ==========================================================================

window.addEventListener('DOMContentLoaded', () => {
  if (isProjectorMode) {
    document.body.classList.add('projector-mode');
    document.title = 'BingHo - Pantalla de Proyección';
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
        applyExternalEvent(msg.eventType, msg.data);
      }
    };
  }

  // Si no es proyector, desbloquear audio en el primer clic/tecla
  if (!isProjectorMode) {
    const unlockAudio = () => {
      getAudioContext();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
  }
});

