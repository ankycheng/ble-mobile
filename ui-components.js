// UI State
const UIState = {
  buttons: {},
  elements: {},
  isDevMode: localStorage.getItem('isDevMode') === 'true',
  currentTowerList: localStorage.getItem('currentTowerList') || "test" // "test" or "favorites"
};

// Initialize UI components
function initializeUI() {
  createButtons();
  setupEventListeners();
  createLocationInfo();
  updateButtonVisibility();
  
  // Update button text based on saved selection
  if (UIState.buttons.switchTowerList) {
    UIState.buttons.switchTowerList.html(
      UIState.currentTowerList === "test" ? "All Towers" : "Favorites"
    );
  }
}

// Create all buttons
function createButtons() {
  // Dev Mode Toggle Button
  UIState.buttons.devMode = createButton("Dev Mode");
  UIState.buttons.devMode.id('dev-mode-button');
  UIState.buttons.devMode.mousePressed(() => {
    UIState.isDevMode = !UIState.isDevMode;
    // Save dev mode state to localStorage
    localStorage.setItem('isDevMode', UIState.isDevMode);
    updateButtonVisibility();
  });

  // Create container for main buttons
  const mainButtonsContainer = createDiv();
  mainButtonsContainer.class('main-buttons-container');

  // Connect Button
  UIState.buttons.connect = createButton("Connect to Arduino");
  UIState.buttons.connect.mousePressed(() => {
    if (window.connectToBLE) {
      window.connectToBLE();
    }
  });
  mainButtonsContainer.child(UIState.buttons.connect);

  // Calibrate Button
  UIState.buttons.calibrate = createButton("Calibrate");
  UIState.buttons.calibrate.id('calibrate-button');
  UIState.buttons.calibrate.mousePressed(() => {
    if (window.calibrateBLE) {
      window.calibrateBLE();
    }
  });
  mainButtonsContainer.child(UIState.buttons.calibrate);

  // Find Tower Button
  UIState.buttons.findTower = createButton(window.GPSState && window.GPSState.isRandom ? "Random Mode" : "Closest Mode");
  UIState.buttons.findTower.id('find-tower-button');
  UIState.buttons.findTower.mousePressed(() => {
    console.log("findTower button pressed");
    if (window.GPSState) {
      window.GPSState.isRandom = !window.GPSState.isRandom;
      // Save mode preference to localStorage
      localStorage.setItem('towerMode', window.GPSState.isRandom ? 'random' : 'closest');
      UIState.buttons.findTower.html(window.GPSState.isRandom ? "Random Mode" : "Closest Mode");
      
      // Update tower selection based on new mode
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
  mainButtonsContainer.child(UIState.buttons.findTower);

  // Switch Tower List Button
  UIState.buttons.switchTowerList = createButton(UIState.currentTowerList === "test" ? "All Towers" : "Favorites");
  UIState.buttons.switchTowerList.mousePressed(() => {
    if (window.loadCellTowerData) {
      UIState.currentTowerList = UIState.currentTowerList === "test" ? "favorites" : "test";
      // Save selection to localStorage
      localStorage.setItem('currentTowerList', UIState.currentTowerList);
      
      const filePath = UIState.currentTowerList === "test" ? "./test_data.json" : "./favorites.json";
      window.loadCellTowerData(() => {
        UIState.buttons.switchTowerList.html(
          UIState.currentTowerList === "test" ? "All Towers" : "Favorites"
        );
      }, filePath);
    }
  });
  mainButtonsContainer.child(UIState.buttons.switchTowerList);

  // Compass Permission Button (iOS)
  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    UIState.buttons.compass = createButton("Enable Compass");
    UIState.buttons.compass.id('compass-button');
    UIState.buttons.compass.mousePressed(() => {
      if (window.requestIOSPermission) {
        window.requestIOSPermission();
      }
    });
  }
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
    // Update debug link with OpenCellID URL
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
  // Location updates
  window.onLocationUpdate = updateLocationDisplay;
  
  // BLE connection status
  window.onBLEStatusChange = (isConnected) => {
    UIState.buttons.calibrate.attribute("disabled", isConnected ? null : "disabled");
  };

  // Calibration state change
  window.onCalibrationStateChange = (canCalibrate) => {
    canCalibrate ? UIState.buttons.calibrate.removeAttribute("disabled") : UIState.buttons.calibrate.elt.setAttribute("disabled", "disabled");
  };
  
  // Error handling
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
  // Update body class for dev/user mode
  document.body.className = UIState.isDevMode ? 'dev-mode' : 'user-mode';
  
  // Update dev mode button text
  UIState.buttons.devMode.html(UIState.isDevMode ? "Dev Mode" : "User Mode");
}

// Export state for other modules
window.UIState = UIState; 