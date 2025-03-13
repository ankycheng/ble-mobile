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
      UIState.currentTowerList === "test" ? "Switch to Favorites" : "Switch to All Towers"
    );
  }
}

// Create all buttons
function createButtons() {
  // Dev Mode Toggle Button
  UIState.buttons.devMode = createButton("Dev Mode");
  styleButton(UIState.buttons.devMode, {
    position: "fixed",
    top: "10px",
    right: "10px",
    width: "100px",
    height: "30px",
    backgroundColor: "#333",
    color: "white",
    border: "none",
    borderRadius: "4px",
    fontSize: "12px",
    zIndex: "1000"
  });
  UIState.buttons.devMode.mousePressed(() => {
    UIState.isDevMode = !UIState.isDevMode;
    // Save dev mode state to localStorage
    localStorage.setItem('isDevMode', UIState.isDevMode);
    updateButtonVisibility();
  });

  // Create container for main buttons
  const mainButtonsContainer = createDiv();
  styleButton(mainButtonsContainer, {
    display: "flex",
    gap: "20px",
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: "20px",
    marginBottom: "20px",
    marginLeft: "20px"
  });

  // Connect Button
  UIState.buttons.connect = createButton("Connect to Arduino");
  styleButton(UIState.buttons.connect, {
    width: "150px",
    height: "50px",
    backgroundColor: "#333",
    color: "white",
    border: "none",
    borderRadius: "4px",
    fontSize: "14px"
  });
  UIState.buttons.connect.mousePressed(() => {
    if (window.connectToBLE) {
      window.connectToBLE();
    }
  });
  mainButtonsContainer.child(UIState.buttons.connect);

  // Calibrate Button
  UIState.buttons.calibrate = createButton("Calibrate");
  styleButton(UIState.buttons.calibrate, {
    width: "100px",
    height: "50px",
    backgroundColor: "#333",
    color: "white",
    border: "none",
    borderRadius: "4px",
    fontSize: "14px"
  });
  UIState.buttons.calibrate.mousePressed(() => {
    if (window.calibrateBLE) {
      window.calibrateBLE();
    }
  });
  mainButtonsContainer.child(UIState.buttons.calibrate);

  // Find Tower Button
  UIState.buttons.findTower = createButton("Find Closest Tower");
  styleButton(UIState.buttons.findTower, {
    width: "150px",
    height: "50px",
    backgroundColor: "#333",
    color: "white",
    border: "none",
    borderRadius: "4px",
    fontSize: "14px"
  });
  UIState.buttons.findTower.mousePressed(() => {
    console.log("findTower button pressed");
    if (window.GPSState && window.findClosestTower) {
      window.findClosestTower(window.GPSState.currentLat, window.GPSState.currentLon);
    }
  });
  mainButtonsContainer.child(UIState.buttons.findTower);

  // Switch Tower List Button
  UIState.buttons.switchTowerList = createButton("Switch to Favorites");
  styleButton(UIState.buttons.switchTowerList, {
    width: "150px",
    height: "50px",
    backgroundColor: "#333",
    color: "white",
    border: "none",
    borderRadius: "4px",
    fontSize: "14px"
  });
  UIState.buttons.switchTowerList.mousePressed(() => {
    if (window.loadCellTowerData) {
      UIState.currentTowerList = UIState.currentTowerList === "test" ? "favorites" : "test";
      // Save selection to localStorage
      localStorage.setItem('currentTowerList', UIState.currentTowerList);
      
      const filePath = UIState.currentTowerList === "test" ? "./test_data.json" : "./favorites.json";
      window.loadCellTowerData(() => {
        UIState.buttons.switchTowerList.html(
          UIState.currentTowerList === "test" ? "Switch to Favorites" : "Switch to All Towers"
        );
      }, filePath);
    }
  });
  mainButtonsContainer.child(UIState.buttons.switchTowerList);

  // Compass Permission Button (iOS)
  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    UIState.buttons.compass = createButton("Enable Compass");
    styleButton(UIState.buttons.compass, {
      width: "150px",
      height: "50px",
      backgroundColor: "#333",
      color: "white",
      border: "none",
      borderRadius: "4px",
      fontSize: "14px",
      marginTop: "20px"
    });
    UIState.buttons.compass.mousePressed(() => {
      if (window.requestIOSPermission) {
        window.requestIOSPermission();
      }
    });
  }
}

// Style a button with given properties
function styleButton(button, styles) {
  Object.entries(styles).forEach(([property, value]) => {
    button.style(property, value);
  });
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
  // Always show connect and calibrate buttons
  UIState.buttons.connect.style("display", "block");
  UIState.buttons.calibrate.style("display", "block");
  
  // Show/hide other buttons based on dev mode
  const devModeButtons = [UIState.buttons.findTower, UIState.buttons.compass];
  devModeButtons.forEach(button => {
    if (button) {
      button.style("display", UIState.isDevMode ? "block" : "none");
    }
  });

  // Update dev mode button appearance
  UIState.buttons.devMode.style("backgroundColor", UIState.isDevMode ? "#000" : "#333");
  UIState.buttons.devMode.html(UIState.isDevMode ? "Dev Mode ON" : "Dev Mode");

  // Show/hide location info elements based on dev mode
  const locationInfo = document.getElementById("location-info");
  if (locationInfo) {
    locationInfo.style.display = UIState.isDevMode ? "block" : "none";
  }
}

// Export state for other modules
window.UIState = UIState; 