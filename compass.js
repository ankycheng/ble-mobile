// Compass State
const CompassState = {
  heading: 0,
  pitch: 0,
  roll: 0,
  isEnabled: false,
  canCalibrate: false
};

// Initialize compass functionality
function initializeCompass() {
  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    // iOS 13+ devices require permission
    return {
      needsPermission: true,
      requestPermission: requestIOSPermission
    };
  } else {
    // Non iOS 13+ devices
    enableCompass();
    return {
      needsPermission: false
    };
  }
}

// Request iOS permission
function requestIOSPermission() {
  DeviceOrientationEvent.requestPermission()
    .then(response => {
      if (response === "granted") {
        enableCompass();
      } else {
        console.log("Device orientation permission denied");
        if (window.onCompassError) {
          window.onCompassError("Permission denied for device orientation");
        }
      }
    })
    .catch(error => {
      console.error("Error requesting device orientation permission:", error);
      if (window.onCompassError) {
        window.onCompassError("Error requesting orientation permission");
      }
    });
}

// Enable compass event listening
function enableCompass() {
  if ("DeviceOrientationAbsoluteEvent" in window) {
    window.addEventListener("deviceorientationabsolute", handleOrientation, true);
  } else {
    window.addEventListener("deviceorientation", handleOrientation, true);
  }
  CompassState.isEnabled = true;
}

// Disable compass
function disableCompass() {
  window.removeEventListener("deviceorientationabsolute", handleOrientation, true);
  window.removeEventListener("deviceorientation", handleOrientation, true);
  CompassState.isEnabled = false;
}

// Handle orientation updates
function handleOrientation(event) {
  // iOS devices
  if (event.webkitCompassHeading) {
    CompassState.heading = event.webkitCompassHeading;
  }
  // Android devices
  else if (event.alpha !== null) {
    CompassState.heading = 360 - event.alpha;
    // Adjust for different device orientations
    const orientation = screen.orientation.type;
    if (orientation === "landscape-primary") {
      CompassState.heading += 90;
    } else if (orientation === "landscape-secondary") {
      CompassState.heading -= 90;
    } else if (orientation === "portrait-secondary") {
      CompassState.heading += 180;
    }

    // Keep heading between 0 and 360
    CompassState.heading = (CompassState.heading + 360) % 360;
  }

  CompassState.pitch = event.beta || 0;
  CompassState.roll = event.gamma || 0;

  // Update calibration state if we have GPS data
  if (window.GPSState && window.GPSState.closestTower) {
    const angle = calculateAngleToTower();
    const headingToTower = CompassState.heading + angle;
    CompassState.canCalibrate = Math.abs(headingToTower) < 5 || Math.abs(headingToTower) > 355;
    
    // Notify UI of calibration state change
    if (window.onCalibrationStateChange) {
      window.onCalibrationStateChange(CompassState.canCalibrate);
    }
  }

  // Notify listeners of compass update
  if (window.onCompassUpdate) {
    window.onCompassUpdate({
      heading: CompassState.heading,
      pitch: CompassState.pitch,
      roll: CompassState.roll,
      canCalibrate: CompassState.canCalibrate
    });
  }
}

// Calculate angle to closest tower
function calculateAngleToTower() {
  if (!window.GPSState || !window.GPSState.closestTower) return 0;
  
  const tower = window.GPSState.closestTower.tower;
  const angle = Math.atan2(
    tower.lat - window.GPSState.currentLat,
    tower.lon - window.GPSState.currentLon
  );
  return (angle * 180) / Math.PI;
}

// Draw compass on canvas
function drawCompass(x, y, radius) {
  // Save current drawing state
  push();
  
  // Move to compass center
  translate(x, y);
  
  // Draw outer circle
  noFill();
  stroke(0);
  strokeWeight(2);
  circle(0, 0, radius * 2);
  
  // Draw cardinal points
  textAlign(CENTER, CENTER);
  textSize(16);
  fill(0);
  noStroke();
  
  const cardinalPoints = ["N", "E", "S", "W"];
  const positions = [
    [0, -radius + 20],
    [radius - 20, 0],
    [0, radius - 20],
    [-radius + 20, 0]
  ];
  
  cardinalPoints.forEach((point, i) => {
    text(point, positions[i][0], positions[i][1]);
  });

  // Draw tower direction if available
  if (window.GPSState && window.GPSState.closestTower) {
    const angle = calculateAngleToTower();
    push();
    rotate(radians(CompassState.heading + angle));
    
    // Draw arrow
    stroke(255, 0, 0);
    strokeWeight(3);
    line(0, 0, 0, -radius + 40);
    
    // Draw arrow head
    noStroke();
    fill(255, 0, 0);
    triangle(
      -10, -radius + 50,
      10, -radius + 50,
      0, -radius + 30
    );
    pop();
  }
  
  // Draw center dot
  fill(0);
  noStroke();
  circle(0, 0, 5);
  
  // Restore drawing state
  pop();
}

// Export state for other modules
window.CompassState = CompassState; 