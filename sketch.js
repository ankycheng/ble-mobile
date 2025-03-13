// Main application entry point 
function preload() {
  loadCellTowerData();
}

function setup() {
  // Create canvas with fixed width and height
  createCanvas(400, 400);
  
  // Initialize all components
  initializeBLE();
  initializeUI();
  
  // Start GPS tracking
  startGPSTracking();
  
  // Initialize compass
  const compassInit = initializeCompass();
  if (compassInit.needsPermission) {
    // iOS devices will show the permission button
    console.log("Compass requires permission on this device");
  }
}

function draw() {
  background(255);
  
  // Draw compass if enabled
  if (CompassState.isEnabled) {
    drawCompass(width / 2, height / 2, 150);
  }
}

// Global event handlers
window.onSensorDataUpdate = (data) => {
  // Handle sensor data updates
  console.log("Sensor Data:", data);
};

// Clean up GPS watch when page is closed
window.onbeforeunload = function () {
  stopGPSTracking();
};