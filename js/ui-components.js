// UI State
const UIState = {
  buttons: {
    devMode: null,
    connect: null,
    reset: null,
    calibrate: null,
    findTower: null,
    switchTowerList: null,
    compass: null,
    setHeading: null,
    // wanderMode: null,  // New button for wander mode
  },
  elements: {
    locationInfo: {
      position: null,
      tower: null,
      distance: null,
      angle: null
    },
    cacheInfo: {
      name: null,
      lastCommit: null
    }
  },
  isDevMode: localStorage.getItem('isDevMode') === 'true',
  currentTowerList: localStorage.getItem('currentTowerList') || "test" // "test" or "favorites"
};

// Initialize UI components
function initializeUI() {
  initializeButtons();
  setupEventListeners();
  createLocationInfo();
  updateButtonVisibility();
  initializeConsole();
  
  // Update button text based on saved selection
  if (UIState.buttons.switchTowerList) {
    UIState.buttons.switchTowerList.innerHTML = 
      UIState.currentTowerList === "test" ? "All Towers" : "Favorites";
  }
}

// Initialize all buttons
function initializeButtons() {
  // Get all button elements
  UIState.buttons.devMode = document.getElementById('dev-mode-button');
  UIState.buttons.connect = document.getElementById('connect-button');
  UIState.buttons.reset = document.getElementById('reset-button');
  UIState.buttons.calibrate = document.getElementById('calibrate-button');
  UIState.buttons.findTower = document.getElementById('find-tower-button');
  UIState.buttons.switchTowerList = document.getElementById('switch-tower-button');
  UIState.buttons.compass = document.getElementById('compass-button');
  UIState.buttons.setHeading = document.getElementById('set-heading-button');
  // UIState.buttons.wanderMode = document.getElementById('wander-mode-button');

  // Dev Mode Toggle Button
  UIState.buttons.devMode.addEventListener('click', () => {
    UIState.isDevMode = !UIState.isDevMode;
    localStorage.setItem('isDevMode', UIState.isDevMode);
    updateButtonVisibility();
  });

  // Connect Button
  UIState.buttons.connect.addEventListener('click', () => {
    if (window.connectToBLE) {
      window.connectToBLE();
    }
  });

  // Reset Button
  UIState.buttons.reset.addEventListener('click', () => {
    if (window.resetDevice) {
      window.resetDevice();
    }
  });

  // Calibrate Button
  UIState.buttons.calibrate.addEventListener('click', () => {
    if (window.calibrateBLE) {
      window.calibrateBLE();
      // Start wander mode after calibration only in dev mode
      // if (window.WanderMode && UIState.isDevMode) {
      //   window.WanderMode.start();
      // }
    }
  });

  // Find Tower Button
  UIState.buttons.findTower.addEventListener('click', () => {
    console.log("findTower button pressed");
    if (window.GPSState) {
      window.GPSState.isRandom = !window.GPSState.isRandom;
      localStorage.setItem('towerMode', window.GPSState.isRandom ? 'random' : 'closest');
      UIState.buttons.findTower.innerHTML = window.GPSState.isRandom ? "Random Mode" : "Closest Mode";
      
      if (window.GPSState.currentLat !== 0 && window.GPSState.currentLon !== 0) {
        const closest = window.GPSState.isRandom ? 
          window.findOneRandomTower() : 
          window.findClosestTower(window.GPSState.currentLat, window.GPSState.currentLon);
          
        if (closest) {
          window.GPSState.closestTower = closest;
          if (window.onLocationUpdate) {
            window.onLocationUpdate({
              position: { lat: window.GPSState.currentLat, lon: window.GPSState.currentLon },
              tower: closest.tower,
              distance: closest.distance.toFixed(2),
              angle: window.CompassState.angleToTower
            });
          }
        }
      }
    }
  });

  // Switch Tower List Button
  UIState.buttons.switchTowerList.addEventListener('click', () => {
    if (window.loadCellTowerData) {
      UIState.currentTowerList = UIState.currentTowerList === "test" ? "favorites" : "test";
      localStorage.setItem('currentTowerList', UIState.currentTowerList);
      
      const filePath = UIState.currentTowerList === "test" ? "./data/test_data.json" : "./data/favorites.json";
      window.loadCellTowerData(() => {
        UIState.buttons.switchTowerList.innerHTML = 
          UIState.currentTowerList === "test" ? "All Towers" : "Favorites";
      }, filePath);
    }
  });

  // Compass Permission Button (iOS)
  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    UIState.buttons.compass.addEventListener('click', () => {
      if (window.requestIOSPermission) {
        window.requestIOSPermission();
      }
    });
  } else {
    // Hide compass button if not needed
    UIState.buttons.compass.style.display = 'none';
  }

  // Set Heading Button
  UIState.buttons.setHeading.addEventListener('click', () => {
    if (window.CompassState && window.GPSState && window.GPSState.closestTower) {
      window.calibrateBLE();
    } else {
      console.log("Compass or GPS state not available");
    }
  });

  // // Wander Mode Button
  // UIState.buttons.wanderMode.addEventListener('click', () => {
  //   const button = UIState.buttons.wanderMode;
  //   const isActive = button.classList.contains('active');
    
  //   if (isActive) {
  //     // Stop wander mode
  //     if (window.WanderMode) {
  //       window.WanderMode.stop();
  //     }
  //   } else {
  //     // Start wander mode
  //     if (window.WanderMode) {
  //       window.WanderMode.start();
  //     }
  //   }
  // });

  // // Initialize wander mode button state
  // if (window.WanderMode && WanderModeState.isActive) {
  //   UIState.buttons.wanderMode.classList.add('active');
  //   UIState.buttons.wanderMode.textContent = 'Wander Mode On';
  // }
}

// Create location info elements
function createLocationInfo() {
  UIState.elements.locationInfo = {
    position: document.getElementById("current-position"),
    radio: document.getElementById("tower-radio"),
    cell: document.getElementById("tower-cell"),
    location: document.getElementById("tower-location"),
    distance: document.getElementById("tower-distance"),
    angle: document.getElementById("tower-angle"),
    debug: document.getElementById("tower-debug").querySelector('a')
  };

  UIState.elements.cacheInfo = {
    name: document.getElementById("cache-name"),
    lastCommit: document.getElementById("last-commit-time")
  };
}

// Update location display
function updateLocationDisplay(data) {
  if (!data || !UIState.elements.locationInfo) return;

  const { position, tower, distance, angle } = data;
  
  if (position) {
    UIState.elements.locationInfo.position.textContent = 
      `Current Position: ${position.lat.toFixed(6)}, ${position.lon.toFixed(6)}`;
  }
  
  if (tower) {
    UIState.elements.locationInfo.radio.textContent = 
      `Tower Radio Type: ${tower.radio || "-"}`;
    UIState.elements.locationInfo.cell.textContent = 
      `Cell ID: ${tower.cell || "-"}`;
    UIState.elements.locationInfo.location.textContent = 
      `Tower Location: ${tower.lat.toFixed(6)}, ${tower.lon.toFixed(6)}`;
    UIState.elements.locationInfo.debug.href = 
      `https://www.opencellid.org/#zoom=18&lat=${tower.lat}&lon=${tower.lon}`;
  }
  
  if (distance) {
    UIState.elements.locationInfo.distance.textContent = 
      `Distance: ${distance} meters`;
  }

  if (angle !== undefined) {
    UIState.elements.locationInfo.angle.textContent = 
      `Angle: ${angle.toFixed(1)}°`;
  }
}

// Setup global event listeners
function setupEventListeners() {
  window.onLocationUpdate = updateLocationDisplay;
  
  window.onBLEStatusChange = (isConnected) => {
    if (isConnected) {
      UIState.buttons.calibrate.removeAttribute("disabled");
    } else {
      UIState.buttons.calibrate.setAttribute("disabled", "disabled");
    }
  };

  window.onCalibrationStateChange = (canCalibrate) => {
    if (canCalibrate) {
      UIState.buttons.calibrate.removeAttribute("disabled");
    } else {
      UIState.buttons.calibrate.setAttribute("disabled", "disabled");
    }
  };
  
  window.onGPSError = (error) => {
    console.error("GPS Error:", error);
    UIState.elements.locationInfo.position.textContent = `GPS Error: ${error}`;
  };
  
  window.onCompassError = (error) => {
    console.error("Compass Error:", error);
  };
}

// Update button visibility based on dev mode
function updateButtonVisibility() {
  document.body.className = UIState.isDevMode ? 'dev-mode' : 'user-mode';
  UIState.buttons.devMode.innerHTML = UIState.isDevMode ? "Dev Mode" : "User Mode";
  
  // Set heading button should only be visible in dev mode
  if (UIState.buttons.setHeading) {
    UIState.buttons.setHeading.style.display = UIState.isDevMode ? 'block' : 'none';
  }
  
  // Show/hide cache info based on dev mode
  const cacheInfoContainer = document.getElementById('cache-info');
  if (cacheInfoContainer) {
    if (UIState.isDevMode) {
      cacheInfoContainer.style.display = 'block';
      // Fetch and update cache info
      fetch('manifest.json')
        .then(response => response.json())
        .then(data => {
          if (UIState.elements.cacheInfo.name) {
            UIState.elements.cacheInfo.name.textContent = `Cache Version: ${data.cacheName}`;
          }
          if (UIState.elements.cacheInfo.lastCommit) {
            const date = new Date(data.lastCommitTime);
            UIState.elements.cacheInfo.lastCommit.textContent = `Last Commit: ${date.toLocaleString()}`;
          }
        })
        .catch(error => console.error('Error fetching manifest:', error));
    } else {
      cacheInfoContainer.style.display = 'none';
    }
  }
}

// Initialize console functionality
function initializeConsole() {
  const consoleOutput = document.getElementById('console-output');
  const clearConsole = document.getElementById('clear-console');

  // Override console.log to output to our console
  const originalConsoleLog = console.log;
  console.log = function(...args) {
    // Call original console.log
    originalConsoleLog.apply(console, args);
    
    // Add to our console output
    if (consoleOutput) {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
      ).join(' ');
      
      const timestamp = new Date().toLocaleTimeString();
      const logEntry = document.createElement('div');
      logEntry.className = 'console-entry';
      logEntry.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;
      consoleOutput.appendChild(logEntry);
      consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }
  };

  // Clear console button
  if (clearConsole) {
    clearConsole.addEventListener('click', () => {
      if (consoleOutput) {
        consoleOutput.innerHTML = '';
      }
    });
  }
}

// Export state for other modules
window.UIState = UIState; 