// GPS State
const GPSState = {
  currentLat: 0,
  currentLon: 0,
  watchId: null,
  cellTowers: null,
  closestTower: null,
  isTracking: false
};

// GPS Configuration
const GPSConfig = {
  options: {
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 0
  }
};

// Load cell tower data
function loadCellTowerData(callback) {
  fetch("./newyork.json")
    .then(response => response.json())
    .then(data => {
      GPSState.cellTowers = data.towers;
      console.log("Loaded", GPSState.cellTowers.length, "cell towers");
      if (callback) callback();
    })
    .catch(error => console.error("Error loading cell tower data:", error));
}

// Start GPS tracking
function startGPSTracking() {
  if (!("geolocation" in navigator)) {
    console.log("Geolocation is not supported by this browser.");
    return;
  }

  if (GPSState.isTracking) return;

  GPSState.watchId = navigator.geolocation.watchPosition(
    updatePosition,
    handleGPSError,
    GPSConfig.options
  );

  // Get initial position
  navigator.geolocation.getCurrentPosition(
    updatePosition,
    handleGPSError,
    GPSConfig.options
  );

  GPSState.isTracking = true;
}

// Stop GPS tracking
function stopGPSTracking() {
  if (GPSState.watchId !== null) {
    navigator.geolocation.clearWatch(GPSState.watchId);
    GPSState.watchId = null;
    GPSState.isTracking = false;
  }
}

// Update position
function updatePosition(position) {
  GPSState.currentLat = position.coords.latitude;
  GPSState.currentLon = position.coords.longitude;

  const closest = findClosestTower(GPSState.currentLat, GPSState.currentLon);
  if (closest) {
    GPSState.closestTower = closest;
    const distance = closest.distance.toFixed(2);
    
    console.log("GPS Update - Current Position:", GPSState.currentLat, GPSState.currentLon);
    console.log("Closest tower:", closest.tower);
    console.log("Distance:", distance, "meters");

    // Update UI with new position and tower info
    if (window.onLocationUpdate) {
      window.onLocationUpdate({
        position: { lat: GPSState.currentLat, lon: GPSState.currentLon },
        tower: closest.tower,
        distance: distance
      });
    }

    // Update BLE distance notification if tower is nearby
    if (window.updateBLEDistance) {
      window.updateBLEDistance(distance < 100);
    }
  }
}

// Find closest tower
function findClosestTower(latitude, longitude) {
  if (!GPSState.cellTowers || !GPSState.cellTowers.length) return null;

  let closestDistance = Infinity;
  let closest = null;

  for (let tower of GPSState.cellTowers) {
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

  return closest ? {
    tower: closest,
    distance: closestDistance
  } : null;
}

// Handle GPS errors
function handleGPSError(error) {
  const errorMessages = {
    1: "User denied the request for Geolocation.",
    2: "Location information is unavailable.",
    3: "The request to get user location timed out.",
    0: "An unknown error occurred."
  };

  console.error("GPS Error:", errorMessages[error.code] || errorMessages[0]);
  
  if (window.onGPSError) {
    window.onGPSError(errorMessages[error.code] || errorMessages[0]);
  }
}

// Export state for other modules
window.GPSState = GPSState;
// window.findClosestTower = findClosestTower;
// window.startGPSTracking = startGPSTracking;
// window.stopGPSTracking = stopGPSTracking;
// window.updatePosition = updatePosition;
// window.handleGPSError = handleGPSError;
// window.calculateDistance = calculateDistance;
