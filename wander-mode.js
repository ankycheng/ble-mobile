// Wander Mode Configuration
const WanderModeConfig = {
  VIBRATION_PATTERNS: {
    START: 0x01,    // 單次短震動
    WANDER: 0x02,   // 雙次短震動
    NEAR: 0x03,     // 長震動
  },
  
  TIME_RANGES: {
    START: {
      CORRECT: { min: 15000, max: 30000 },    // 正確方向：5-10秒
      WARNING: { min: 10000, max: 20000 },     // 偏離方向：3-5秒
      WRONG: { min: 8000, max: 10000 }        // 錯誤方向：1-3秒
    },
    WANDER: {
      CORRECT: { min: 60000, max: 120000 },  // 正確方向：1-2分鐘
      WARNING: { min: 30000, max: 60000 },   // 偏離方向：30秒-1分鐘
      WRONG: { min: 15000, max: 30000 }      // 錯誤方向：15-30秒
    },
    NEAR: {
      CORRECT: { min: 2000, max: 4000 },     // 正確方向：2-4秒
      WARNING: { min: 1000, max: 2000 },     // 偏離方向：1-2秒
      WRONG: { min: 500, max: 1000 }         // 錯誤方向：0.5-1秒
    }
  },

  DIRECTION_THRESHOLDS: {
    CORRECT: 45,    // 正確方向的角度範圍（±45度）
    WARNING: 90,    // 警告方向的角度範圍（±90度）
  },

  NEAR_THRESHOLD: 50,  // 50公尺內視為接近
  MAX_OFFSET: 20,      // 最大隨機偏差值（公尺）
};

// Wander Mode State
const WanderModeState = {
  isActive: false,  // Changed back to false by default
  currentPhase: 'start',  // 'start' | 'wander' | 'near'
  lastVibrationTime: 0,
  nextVibrationTime: 0,
  timer: null,
  userTrajectory: [],
};

// Helper Functions
function normalizeAngle(angle) {
  angle = angle % 360;
  return angle < 0 ? angle + 360 : angle;
}

function getRandomInterval(phase, directionStatus) {
  const range = WanderModeConfig.TIME_RANGES[phase.toUpperCase()][directionStatus];
  return Math.floor(Math.random() * (range.max - range.min + 1) + range.min);
}

function getDirectionStatus(currentBearing, targetBearing) {
  const bearingDiff = Math.abs(normalizeAngle(targetBearing - currentBearing));
  
  if (bearingDiff <= WanderModeConfig.DIRECTION_THRESHOLDS.CORRECT) {
    return 'CORRECT';
  } else if (bearingDiff <= WanderModeConfig.DIRECTION_THRESHOLDS.WARNING) {
    return 'WARNING';
  } else {
    return 'WRONG';
  }
}

// Main Control Functions
function startWanderMode() {
  // Check if in dev mode
  if (!window.UIState || !window.UIState.isDevMode) {
    console.log('Cannot start wander mode: Not in dev mode');
    return;
  }

  console.log('Starting wander mode');
  WanderModeState.isActive = true;
  WanderModeState.currentPhase = 'start';
  scheduleNextVibration();
  
  // Update button state
  const wanderButton = document.getElementById('wander-mode-button');
  if (wanderButton) {
    wanderButton.classList.add('active');
    wanderButton.textContent = 'Wander Mode On';
  }
}

function stopWanderMode() {
  WanderModeState.isActive = false;
  if (WanderModeState.timer) {
    clearTimeout(WanderModeState.timer);
    WanderModeState.timer = null;
  }
  
  // Update button state
  const wanderButton = document.getElementById('wander-mode-button');
  if (wanderButton) {
    wanderButton.classList.remove('active');
    wanderButton.textContent = 'Wander Mode Off';
  }
}

function updatePhase(distance) {
  const oldPhase = WanderModeState.currentPhase;
  
  if (distance < WanderModeConfig.NEAR_THRESHOLD) {
    WanderModeState.currentPhase = 'near';
  } else if (WanderModeState.currentPhase === 'start' && 
             distance > WanderModeConfig.NEAR_THRESHOLD * 2) {
    WanderModeState.currentPhase = 'wander';
  }

  // 如果階段改變，重新安排震動
  if (oldPhase !== WanderModeState.currentPhase) {
    scheduleNextVibration();
  }
}

function scheduleNextVibration() {
  if (!WanderModeState.isActive) return;

  // 清除現有的timer
  if (WanderModeState.timer) {
    clearTimeout(WanderModeState.timer);
  }

  // 取得當前方向狀態
  const directionStatus = getDirectionStatus(
    CompassState.heading,
    CompassState.angleToTower
  );

  // 計算下次震動時間
  const interval = getRandomInterval(WanderModeState.currentPhase, directionStatus);
  
  WanderModeState.timer = setTimeout(() => {
    checkAndVibrate();
    scheduleNextVibration();
  }, interval);

  WanderModeState.nextVibrationTime = Date.now() + interval;
}

function checkAndVibrate() {
  if (!WanderModeState.isActive) return;
  console.log('Checking and vibrating');
  const directionStatus = getDirectionStatus(
    CompassState.heading,
    CompassState.angleToTower
  );

  // 根據不同階段和方向狀態選擇震動模式
  let pattern;
  switch (WanderModeState.currentPhase) {
    case 'near':
      pattern = WanderModeConfig.VIBRATION_PATTERNS.NEAR;
      break;
    case 'start':
      pattern = WanderModeConfig.VIBRATION_PATTERNS.START;
      break;
    case 'wander':
      pattern = WanderModeConfig.VIBRATION_PATTERNS.WANDER;
      break;
  }

  // 發送震動
  if (window.BLEState && window.BLEState.distanceCharacteristic) {
    console.log('Sending vibration:', pattern);
    const bufferToSend = Uint8Array.of(pattern);
    window.BLEState.distanceCharacteristic.writeValue(bufferToSend)
      .catch(error => console.error('Error sending vibration:', error));
  }

  WanderModeState.lastVibrationTime = Date.now();

  // 記錄軌跡點
  WanderModeState.userTrajectory.push({
    timestamp: Date.now(),
    position: {
      latitude: GPSState.currentLat,
      longitude: GPSState.currentLon
    },
    heading: CompassState.heading,
    directionStatus,
    phase: WanderModeState.currentPhase
  });
}

// Export functions for global access
window.WanderMode = {
  start: startWanderMode,
  stop: stopWanderMode,
  updatePhase,
  getTimeUntilNextVibration: () => {
    if (!WanderModeState.nextVibrationTime) return 0;
    return Math.max(0, WanderModeState.nextVibrationTime - Date.now());
  }
};

// Remove the auto-start on load
// Instead, we'll start it after calibration 