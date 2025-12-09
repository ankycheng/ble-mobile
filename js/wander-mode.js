// Wander Mode Configuration
const WanderModeConfig = {
  VIBRATION_PATTERNS: {
    START: 0x01,    // Single short vibration
    WANDER: 0x02,   // Double short vibration
    NEAR: 0x03,     // Long vibration
  },
  
  TIME_RANGES: {
    START: {
      CORRECT: { min: 15000, max: 30000 },    // Correct direction: 5-10 seconds
      WARNING: { min: 10000, max: 20000 },     // Off-course direction: 3-5 seconds
      WRONG: { min: 8000, max: 10000 }        // Wrong direction: 1-3 seconds
    },
    WANDER: {
      CORRECT: { min: 60000, max: 120000 },  // Correct direction: 1-2 minutes
      WARNING: { min: 30000, max: 60000 },   // Off-course direction: 30 seconds-1 minute
      WRONG: { min: 15000, max: 30000 }      // Wrong direction: 15-30 seconds
    },
    NEAR: {
      CORRECT: { min: 2000, max: 4000 },     // Correct direction: 2-4 seconds
      WARNING: { min: 1000, max: 2000 },     // Off-course direction: 1-2 seconds
      WRONG: { min: 500, max: 1000 }         // Wrong direction: 0.5-1 second
    }
  },

  DIRECTION_THRESHOLDS: {
    CORRECT: 45,    // Angle range for correct direction (±45 degrees)
    WARNING: 90,    // Angle range for warning direction (±90 degrees)
  },

  NEAR_THRESHOLD: 50,  // Considered near when within 50 meters
  MAX_OFFSET: 20,      // Maximum random offset value (meters)
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
  // const wanderButton = document.getElementById('wander-mode-button');
  // if (wanderButton) {
  //   wanderButton.classList.add('active');
  //   wanderButton.textContent = 'Wander Mode On';
  // }
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

  // If phase changes, reschedule vibration
  if (oldPhase !== WanderModeState.currentPhase) {
    scheduleNextVibration();
  }
}

function scheduleNextVibration() {
  if (!WanderModeState.isActive) return;

  // Clear existing timer
  if (WanderModeState.timer) {
    clearTimeout(WanderModeState.timer);
  }

  // Get current direction status
  const directionStatus = getDirectionStatus(
    CompassState.heading,
    CompassState.angleToTower
  );

  // Calculate next vibration time
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

  // Select vibration pattern based on different phases and direction status
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

  // Send vibration
  if (window.BLEState && window.BLEState.distanceCharacteristic) {
    console.log('Sending vibration:', pattern);
    const bufferToSend = Uint8Array.of(pattern);
    window.BLEState.distanceCharacteristic.writeValue(bufferToSend)
      .catch(error => console.error('Error sending vibration:', error));
  }

  WanderModeState.lastVibrationTime = Date.now();

  // Record trajectory point
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