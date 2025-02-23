// UI State
const UIState = {
  buttons: {},
  elements: {}
};

// Initialize UI components
function initializeUI() {
  createButtons();
  setupEventListeners();
  createLocationInfo();
}

// Create all buttons
function createButtons() {
  // Connect Button
  UIState.buttons.connect = createButton("Connect to Arduino");
  styleButton(UIState.buttons.connect, {
    marginLeft: "30px",
    width: "150px",
    height: "50px"
  });
  UIState.buttons.connect.mousePressed(() => {
    if (window.connectToBLE) {
      window.connectToBLE();
    }
  });

  // Calibrate Button
  UIState.buttons.calibrate = createButton("Calibrate");
  styleButton(UIState.buttons.calibrate, {
    marginLeft: "30px",
    width: "100px",
    height: "50px"
  });
  UIState.buttons.calibrate.mousePressed(() => {
    if (window.calibrateBLE) {
      window.calibrateBLE();
    }
  });
  UIState.buttons.calibrate.attribute("disabled", "disabled");

  // Find Tower Button
  UIState.buttons.findTower = createButton("Find Closest Tower");
  styleButton(UIState.buttons.findTower, {
    marginLeft: "30px",
    width: "150px",
    height: "50px",
    backgroundColor: "#4CAF50",
    color: "white",
    border: "none",
    borderRadius: "4px"
  });
  UIState.buttons.findTower.mousePressed(() => {
    console.log("findTower button pressed");
    if (window.GPSState && window.findClosestTower) {
      window.findClosestTower(window.GPSState.currentLat, window.GPSState.currentLon);
    }
  });

  // Compass Permission Button (iOS)
  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    UIState.buttons.compass = createButton("Enable Compass");
    styleButton(UIState.buttons.compass, {
      marginLeft: "30px",
      width: "150px",
      height: "50px"
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
    distance: document.getElementById("tower-distance")
  };
}

// Update location display
function updateLocationDisplay(data) {
  if (!data || !UIState.elements.locationInfo) return;

  const { position, tower, distance } = data;
  
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
  }
  
  if (distance) {
    UIState.elements.locationInfo.distance.textContent = 
      `Distance: ${distance} meters`;
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
    console.log("Calibration state change:", canCalibrate);
    console.log("UIState.buttons.calibrate:", UIState.buttons.calibrate);
    canCalibrate ? UIState.buttons.calibrate.removeAttribute("disabled") : UIState.buttons.calibrate.setAttribute("disabled", "disabled");
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

// Export state for other modules
window.UIState = UIState; 