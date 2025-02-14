let myBLE;

// const serviceUUID = "0000180a-0000-1000-8000-00805f9b34fb";
const serviceUUID = "19B10010-E8F2-537E-4F6C-D104768A1214";
const characteristicUUID = "19b10011-e8f2-537e-4f6c-d104768a1214";
const clibrationCharacteristicUUID = "49c29251-5fe3-4832-83dd-e736b673b0bf";
const distanceCharacteristicUUID = "49c29252-5fe3-4832-83dd-e736b673b0bf";

let myCharacteristic;
let clibrationCharacteristic;
let distanceCharacteristic;
let isConnected = false;

// Add variables for orientation data
let heading = 0;
let pitch = 0;
let roll = 0;

// Add variables for GPS and cell tower data
let cellTowers;
let currentLat = 0;
let currentLon = 0;
let closestTower = null;
let watchId = null; // Add GPS watch ID
let calibrateButton = null;

let canCalibrate = false;

function preload() {
  // Load the JSON file and assign it directly to cellTowers
  loadJSON("./newyork.json", function (data) {
    cellTowers = data.towers;
    console.log("Loaded", cellTowers.length, "cell towers");
  });
}

function setup() {
  createCanvas(400, 400);

  myBLE = new p5ble();

  // Start GPS tracking
  startGPSTracking();

  const connectButton = createButton("Connect to Arduino");
  connectButton.mousePressed(connectToBLE);
  connectButton.style("margin-left", "30px");
  connectButton.style("width", "150px");
  connectButton.style("height", "50px");

  calibrateButton = createButton("Calibrate");
  calibrateButton.mousePressed(calibrate);
  calibrateButton.style("margin-left", "30px");
  calibrateButton.style("width", "100px");
  calibrateButton.style("height", "50px");
  calibrateButton.attribute("disabled", canCalibrate ? null : "disabled");
  // Add Find Closest Tower button
  const findTowerButton = createButton("Find Closest Tower");
  findTowerButton.mousePressed(() => {
    findClosestTower(currentLat, currentLon);
  });
  findTowerButton.style("margin-left", "30px");
  findTowerButton.style("width", "150px");
  findTowerButton.style("height", "50px");
  findTowerButton.style("background-color", "#4CAF50");
  findTowerButton.style("color", "white");
  findTowerButton.style("border", "none");
  findTowerButton.style("border-radius", "4px");

  // Request device orientation permission (required for iOS 13+)
  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    // iOS 13+ devices
    const orientationButton = createButton("Enable Compass");
    orientationButton.mousePressed(() => {
      DeviceOrientationEvent.requestPermission()
        .then((response) => {
          if (response === "granted") {
            window.addEventListener("deviceorientation", handleOrientation, true);
          }
        })
        .catch(console.error);
    });
  } else {
    // Non iOS 13+ devices
    window.addEventListener("deviceorientationabsolute", handleOrientation, true);
  }
}

function connectToBLE() {
  myBLE.connect(serviceUUID, gotCharacteristics, {
    filters: [
      {
        services: [serviceUUID],
        characteristics: [characteristicUUID],
      },
    ],
  });
}

function gotCharacteristics(error, characteristics) {
  if (error) {
    console.log("error: ", error);
    return;
  }

  myCharacteristic = characteristics.find((c) => c.uuid === characteristicUUID);
  clibrationCharacteristic = characteristics.find(
    (c) => c.uuid === clibrationCharacteristicUUID
  );

  distanceCharacteristic = characteristics.find(
    (c) => c.uuid === distanceCharacteristicUUID
  );

  isConnected = true;

  // When connecting to the device
  myCharacteristic.startNotifications().then(() => {
    myCharacteristic.addEventListener(
      "characteristicvaluechanged",
      onCharacteristicValueChanged
    );
  });
}

function gotValue(error, value) {
  if (error) {
    console.log("error: ", error);
    return;
  }

  const data = new Float32Array(value.buffer);
  const [xAcc, yAcc, zAcc, xGyro, yGyro, zGyro] = data;
  console.log("Accelerometer:", { xAcc, yAcc, zAcc });
  console.log("Gyroscope:", { xGyro, yGyro, zGyro });
  // Continue reading
  myBLE.read(myCharacteristic, gotValue);
}

function writeToBle() {
  const inputValue = "gg";
  myBLE.write(clibrationCharacteristic, inputValue);
}

function calibrate() {
  myBLE.write(clibrationCharacteristic, "1");
}

// Add function to find closest tower
function findClosestTower(latitude, longitude) {
  console.log("Finding closest tower");
  console.log(latitude, longitude);
  if (!cellTowers || !cellTowers.length) return null;

  let closestDistance = Infinity;
  let closest = null;

  for (let tower of cellTowers) {
    const distance = calculateDistance(
      latitude,
      longitude,
      tower.lat,
      tower.lon
    );

    if (distance < closestDistance) {
      closestDistance = distance;
      closest = tower;
    }
  }

  return {
    tower: closest,
    distance: closestDistance,
  };
}

// Add GPS tracking functions
function startGPSTracking() {
  if ("geolocation" in navigator) {
    const options = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0,
    };

    watchId = navigator.geolocation.watchPosition(
      updatePosition,
      handleGPSError,
      options
    );

    // Get initial position
    navigator.geolocation.getCurrentPosition(
      updatePosition,
      handleGPSError,
      options
    );
  } else {
    console.log("Geolocation is not supported by this browser.");
  }
}

function updatePosition(position) {
  currentLat = position.coords.latitude;
  currentLon = position.coords.longitude;

  // Find and update closest tower when position changes
  const closest = findClosestTower(currentLat, currentLon);
  if (closest) {
    closestTower = closest;
    const distance = closest.distance.toFixed(2);
    console.log("GPS Update - Current Position:", currentLat, currentLon);
    console.log("Closest tower:", closest.tower);
    console.log("Distance:", distance, "meters");
    if (distance < 100) {
      myBLE.write(distanceCharacteristic, "1");
    }

    updateLocationDisplay();
  }
}

function handleGPSError(error) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      console.log("User denied the request for Geolocation.");
      break;
    case error.POSITION_UNAVAILABLE:
      console.log("Location information is unavailable.");
      break;
    case error.TIMEOUT:
      console.log("The request to get user location timed out.");
      break;
    default:
      console.log("An unknown error occurred.");
      break;
  }
}

// Modify draw function to include GPS accuracy
function draw() {
  background(255);
  updateLocationDisplay();

  // Draw compass
  drawCompass(width / 2, height / 2, 150); // Draw compass in center with radius 150
}

// Add this new function to update the HTML elements
function updateLocationDisplay() {
  // Update current position
  document.getElementById(
    "current-position"
  ).textContent = `Current Position: ${currentLat.toFixed(
    6
  )}, ${currentLon.toFixed(6)}`;

  // Update tower info if available
  if (closestTower) {
    document.getElementById(
      "tower-radio"
    ).textContent = `Tower Radio Type: ${closestTower.tower.radio}`;
    document.getElementById(
      "tower-cell"
    ).textContent = `Cell ID: ${closestTower.tower.cell}`;
    document.getElementById(
      "tower-location"
    ).textContent = `Tower Location: ${closestTower.tower.lat}, ${closestTower.tower.lon}`;
    document.getElementById(
      "tower-distance"
    ).textContent = `Distance: ${closestTower.distance.toFixed(2)} meters`;
  }
}

// Clean up GPS watch when page is closed
window.onbeforeunload = function () {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
  }
};

// Modify onCharacteristicValueChanged to use both BLE and GPS data
function onCharacteristicValueChanged(event) {
  const value = new Float32Array(event.target.value.buffer);
  console.log("BLE value: ", value);
}

// Add this new function to draw the compass
function drawCompass(x, y, radius) {
  push(); // Save current drawing state
  translate(x, y); // Move to center of compass

  // Draw outer circle
  noFill();
  stroke(0);
  strokeWeight(2);
  circle(0, 0, radius * 2);

  // Draw cardinal directions
  textSize(16);
  textAlign(CENTER, CENTER);
  fill(0);
  noStroke();
  text("N", 0, -radius - 20);
  text("S", 0, radius + 20);
  text("E", radius + 20, 0);
  text("W", -radius - 20, 0);

  if (closestTower) {
    // get angle to closest tower from current position
    const angle = atan2(
      closestTower.tower.lat - currentLat,
      closestTower.tower.lon - currentLon
    );
    const towerHeading = (angle * 180) / Math.PI;

    // Draw compass needle
    push();
    // keep heading to the tower
    const headingToTower = heading + towerHeading;
    rotate(radians(headingToTower));

    canCalibrate = abs(headingToTower) < 5 || abs(headingToTower) > 355;
    canCalibrate
      ? calibrateButton.removeAttribute("disabled")
      : calibrateButton.attribute("disabled", "disabled");

    // Draw arrow
    strokeWeight(3);
    stroke(255, 0, 0); // Red for North
    line(0, 0, 0, -radius * 0.8);
    fill(255, 0, 0);
    triangle(-10, -radius * 0.7, 10, -radius * 0.7, 0, -radius * 0.9);

    pop();

    // Draw center dot
    fill(0);
    noStroke();
    circle(0, 0, 5);
  }

  pop(); // Restore original drawing state
}

// Add handler for device orientation
function handleOrientation(event) {
  // alpha is the compass direction (in degrees)

  if (event.webkitCompassHeading) {
    heading = event.webkitCompassHeading;
  } else {
    heading = event.alpha;
  }

  if (event.alpha !== null) {
    heading = event.alpha;
    // Adjust for different device orientations
    if (window.orientation === 90) {
      heading += 90;
    } else if (window.orientation === -90) {
      heading -= 90;
    } else if (window.orientation === 180) {
      heading += 180;
    }

    // Keep heading between 0 and 360
    heading = (heading + 360) % 360;
  }
}
