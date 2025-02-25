const isIOS =
  navigator.userAgent.match(/(iPod|iPhone|iPad)/) &&
  navigator.userAgent.match(/AppleWebKit/);

// Compass State
const CompassState = {
  heading: 0,
  pitch: 0,
  roll: 0,
  isEnabled: false,
  canCalibrate: true,
  angleToTower: 0,
};

function initializeCompass() {
  if (isIOS) {
    alert("not supported on iOS");
  } else {
    window.addEventListener(
      "deviceorientationabsolute",
      handleOrientation,
      true
    );
    CompassState.isEnabled = true;
    return { needsPermission: false };
  }
}

// Disable compass
function disableCompass() {
  window.removeEventListener(
    "deviceorientationabsolute",
    handleOrientation,
    true
  );
  window.removeEventListener("deviceorientation", handleOrientation, true);
  CompassState.isEnabled = false;
}

// Handle orientation updates
// https://dev.to/orkhanjafarovr/real-compass-on-mobile-browsers-with-javascript-3emi
function handleOrientation(event) {
  // iOS devices
  if (event.webkitCompassHeading) {
    CompassState.heading = event.webkitCompassHeading;
  }
  // Android devices
  else if (event.alpha !== null) {
    CompassState.heading = event.alpha;
    // Adjust for different device orientations
    const orientation = screen.orientation.type;
    if (orientation === "landscape-primary") {
      CompassState.heading -= 90;
    } else if (orientation === "landscape-secondary") {
      CompassState.heading += 90;
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
    const angle = calculateAngleToTower(
      window.GPSState.currentLat,
      window.GPSState.currentLon,
      window.GPSState.closestTower.tower.lat,
      window.GPSState.closestTower.tower.lon
    );

    const headingToTower = CompassState.heading + angle;
    // CompassState.canCalibrate = Math.abs(headingToTower) < 5 || Math.abs(headingToTower) > 355;
    CompassState.canCalibrate = true;
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
      canCalibrate: CompassState.canCalibrate,
    });
  }
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
    [-radius + 20, 0],
  ];

  // Draw tower direction if available
  if (window.GPSState && window.GPSState.closestTower) {
    // draw line to north
    const angle = 0;
    push();
    rotate(radians(CompassState.heading + angle));

    cardinalPoints.forEach((point, i) => {
      text(point, positions[i][0], positions[i][1]);
    });

    // Draw arrow
    stroke(255, 0, 0);
    strokeWeight(3);
    line(0, 0, 0, -radius + 40);

    // Draw arrow head
    noStroke();
    fill(255, 0, 0);
    triangle(-10, -radius + 50, 10, -radius + 50, 0, -radius + 30);
    pop();

    push();
    const angleToTower = calculateAngleToTower(
      window.GPSState.currentLat,
      window.GPSState.currentLon,
      window.GPSState.closestTower.tower.lat,
      window.GPSState.closestTower.tower.lon
    );
    CompassState.angleToTower = angleToTower;
    rotate(radians(CompassState.heading + angleToTower));
    stroke(0, 255, 0);
    strokeWeight(2);
    line(0, 0, 0, -radius + 40);
    pop();

    // Draw center dot
    fill(0);
    noStroke();
    circle(0, 0, 5);
  }

  // Restore drawing state
  pop();
}

// Export state for other modules
window.CompassState = CompassState;

// Ref: https://www.sunearthtools.com/tools/distance.php
function calculateAngleToTower(lat1, lon1, lat2, lon2) {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  let θ = Math.atan2(y, x);
  // Convert from radians to degrees and normalize to 0-360°
  return ((θ * 180) / Math.PI + 360) % 360;
}
