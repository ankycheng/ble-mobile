// Main application entry point 
function preload() {
  loadCellTowerData();
}

function setup() {
  // Create canvas with responsive size
  const canvasWidth = Math.min(window.innerWidth, 1200); // Max width of 1200px
  const canvasHeight = Math.min(window.innerHeight * 0.4, 800); // 80% of window height, max 800px
  const canvas = createCanvas(canvasWidth, canvasHeight);
  canvas.parent('container'); // Place canvas in the existing container
  
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
  const canvasWidth = Math.min(window.innerWidth, 1200); // Max width of 1200px
  const canvasHeight = Math.min(window.innerHeight * 0.4, 800); // 80% of window height, max 800px
  resizeCanvas(canvasWidth, canvasHeight);
}

function draw() {
  background(255);
  
  // Draw compass if enabled
  if (CompassState.isEnabled) {
    // Calculate compass radius based on canvas dimensions
    const maxRadius = Math.min(width, height) / 2;
    const compassRadius = Math.min(200, maxRadius * 0.8); // 80% of the smaller canvas dimension, max 200px
    drawCompass(width / 2, height / 2, compassRadius);
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