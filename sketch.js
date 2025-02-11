let myBLE;

// const serviceUUID = "0000180a-0000-1000-8000-00805f9b34fb";
const serviceUUID = "19B10010-E8F2-537E-4F6C-D104768A1214";
const characteristicUUID = "19b10011-e8f2-537e-4f6c-d104768a1214";
const clibrationCharacteristicUUID = "49c29251-5fe3-4832-83dd-e736b673b0bf";

let myCharacteristic;
let clibrationCharacteristic;
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

function preload() {
  // Load the JSON file and assign it directly to cellTowers
  loadJSON('./newyork.json', function(data) {
    cellTowers = data.towers;
    console.log(cellTowers)
  });
}

function setup() {
  createCanvas(400, 400);
  console.log('Loaded', cellTowers.length, 'cell towers');
  myBLE = new p5ble();

  // Start GPS tracking
  startGPSTracking();

  const connectButton = createButton("Connect to Arduino");
  connectButton.mousePressed(connectToBLE);
  connectButton.style("margin-left", "30px");
  connectButton.style("width", "150px");
  connectButton.style("height", "50px");

  const calibrateButton = createButton("Calibrate");
  calibrateButton.mousePressed(calibrate);
  calibrateButton.style("margin-left", "30px");
  calibrateButton.style("width", "100px");
  calibrateButton.style("height", "50px");

  // Add Find Closest Tower button
  const findTowerButton = createButton("Find Closest Tower");
  findTowerButton.mousePressed(findClosestTowerNow);
  findTowerButton.style("margin-left", "30px");
  findTowerButton.style("width", "150px");
  findTowerButton.style("height", "50px");
  findTowerButton.style("background-color", "#4CAF50");
  findTowerButton.style("color", "white");
  findTowerButton.style("border", "none");
  findTowerButton.style("border-radius", "4px");

  // initLogTracker();
}

// function draw() {
//   background(255); // set background to white
// }

function initLogTracker() {
  // Log to console
  var old = console.log;
  var logger = document.getElementById("log");
  console.log = function (message) {
    if (typeof message == "object") {
      logger.innerHTML +=
        (JSON && JSON.stringify ? JSON.stringify(message) : message) + "<br />";
    } else {
      logger.innerHTML += message + "<br />";
    }
  };
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
  const inputValue = input.value();
  myBLE.write(clibrationCharacteristic, inputValue);
}

function calibrate() {
  myBLE.write(clibrationCharacteristic, "1");
}

// Add function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // returns distance in meters
}

// Add function to find closest tower
function findClosestTower(latitude, longitude) {
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
    distance: closestDistance
  };
}

// Add GPS tracking functions
function startGPSTracking() {
  if ("geolocation" in navigator) {
    const options = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0
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
    console.log('GPS Update - Current Position:', currentLat, currentLon);
    console.log('Closest tower:', closest.tower);
    console.log('Distance:', (closest.distance).toFixed(2), 'meters');
    updateLocationDisplay();
  }
}

function handleGPSError(error) {
  switch(error.code) {
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
}

// Add this new function to update the HTML elements
function updateLocationDisplay() {
  // Update current position
  document.getElementById('current-position').textContent = 
    `Current Position: ${currentLat.toFixed(6)}, ${currentLon.toFixed(6)}`;
  
  // Update tower info if available
  if (closestTower) {
    document.getElementById('tower-radio').textContent = 
      `Tower Radio Type: ${closestTower.tower.radio}`;
    document.getElementById('tower-cell').textContent = 
      `Cell ID: ${closestTower.tower.cell}`;
    document.getElementById('tower-location').textContent = 
      `Tower Location: ${closestTower.tower.lat}, ${closestTower.tower.lon}`;
    document.getElementById('tower-distance').textContent = 
      `Distance: ${closestTower.distance.toFixed(2)} meters`;
  }
}

// Clean up GPS watch when page is closed
window.onbeforeunload = function() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
  }
};

// Modify onCharacteristicValueChanged to use both BLE and GPS data
function onCharacteristicValueChanged(event) {
  const value = new Float32Array(event.target.value.buffer);
  console.log("BLE value: ", value);
  
  // Update orientation from BLE
  if (value.length >= 3) {
    [heading, pitch, roll] = value;
  }
  
  // Note: We're now using GPS for position instead of BLE
  // The closest tower calculation is handled in updatePosition()
}

// Add function to handle button click
function findClosestTowerNow() {
  if (currentLat === 0 && currentLon === 0) {
    console.log("Waiting for GPS position...");
    return;
  }

  const closest = findClosestTower(currentLat, currentLon);
  if (closest) {
    closestTower = closest;
    console.log('=== Current Location ===');
    console.log(`Latitude: ${currentLat.toFixed(6)}`);
    console.log(`Longitude: ${currentLon.toFixed(6)}`);
    console.log('=== Closest Tower Info ===');
    console.log('Radio Type:', closest.tower.radio);
    console.log('Cell ID:', closest.tower.cell);
    console.log('Tower Location:', closest.tower.lat, closest.tower.lon);
    console.log('Range:', closest.tower.range, 'meters');
    console.log('Distance:', (closest.distance).toFixed(2), 'meters');
  } else {
    console.log("No tower data available");
  }
}
