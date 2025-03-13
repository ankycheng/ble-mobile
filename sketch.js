// Main application entry point 
function preload() {
  loadCellTowerData();
}

function setup() {
  // Create canvas with screen width and fixed height
  createCanvas(window.innerWidth, 800);
  
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

// Handle window resize
function windowResized() {
  resizeCanvas(window.innerWidth, 800);
}

function draw() {
  background(255);
  
  // Draw compass if enabled
  if (CompassState.isEnabled) {
    drawCompass(width / 2, height / 2, 300); // Increased radius from 150 to 300
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