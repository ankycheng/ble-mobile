// BLE Configuration
const BLEConfig = {
  serviceUUID: "19B10010-E8F2-537E-4F6C-D104768A1214",
  calibrationCharacteristicUUID: "49c29251-5fe3-4832-83dd-e736b673b0bf",
  distanceCharacteristicUUID: "49c29252-5fe3-4832-83dd-e736b673b0bf",
  resetCharacteristicUUID: "49c29254-5fe3-4832-83dd-e736b673b0bf",
  restartSessionCharacteristicUUID: "49c29255-5fe3-4832-83dd-e736b673b0bf",
};

// BLE State
const BLEState = {
  myBLE: null,
  calibrationCharacteristic: null,
  distanceCharacteristic: null,
  resetCharacteristic: null,
  restartSessionCharacteristic: null,
  isConnected: false,
};

// BLE Handler Functions
function initializeBLE() {
  BLEState.myBLE = new p5ble();
}

function connectToBLE() {
  BLEState.myBLE.connect(BLEConfig.serviceUUID, gotCharacteristics, {
    filters: [
      {
        services: [BLEConfig.serviceUUID],
        characteristics: [],
      },
    ],
  });
}

function gotCharacteristics(error, characteristics) {
  if (error) {
    console.log("error: ", error);
    alert("Failed to connect to Arduino. Please check if the device is turned on and in range.");
    BLEState.isConnected = false;
    return;
  }

  BLEState.calibrationCharacteristic = characteristics.find(
    (c) => c.uuid === BLEConfig.calibrationCharacteristicUUID
  );

  BLEState.distanceCharacteristic = characteristics.find(
    (c) => c.uuid === BLEConfig.distanceCharacteristicUUID
  );

  BLEState.resetCharacteristic = characteristics.find(
    (c) => c.uuid === BLEConfig.resetCharacteristicUUID
  );

  BLEState.restartSessionCharacteristic = characteristics.find(
    (c) => c.uuid === BLEConfig.restartSessionCharacteristicUUID
  );

  if (!BLEState.calibrationCharacteristic || !BLEState.distanceCharacteristic || !BLEState.resetCharacteristic || !BLEState.restartSessionCharacteristic) {
    alert("Failed to find required BLE characteristics. Please check if the Arduino is properly configured.");
    BLEState.isConnected = false;
    return;
  }

  BLEState.isConnected = true;
  console.log("BLE connected");
  alert("BLE connected");

  // setInterval(() => updateBLEDistance(true), 5000);
}

// Calibrate the BLE device and send the angle to the device
function calibrateBLE() {
  if (!BLEState.isConnected) {
    alert("Not connected to Arduino. Please connect first.");
    return;
  }

  if (!BLEState.calibrationCharacteristic) {
    alert("Calibration characteristic not available. Please reconnect to Arduino.");
    return;
  }

  if (typeof CompassState === 'undefined' || typeof CompassState.angleToTower === 'undefined') {
    alert("Compass data not available. Please ensure compass is enabled and calibrated.");
    return;
  }

  sendAngleToBLE(CompassState.angleToTower);
}

function sendAngleToBLE(angle) {
  if (!BLEState.isConnected) {
    alert("Not connected to Arduino. Please connect first.");
    return;
  }

  angle = Math.round(angle);
  // Create an ArrayBuffer of 2 bytes.
  let buffer = new ArrayBuffer(2);
  let view = new DataView(buffer);
  view.setUint16(0, angle, true);
  // Cannot use BLEState.myBLE.write as p5.ble can only send strings or 8bit data
  console.log("write angle to ble: ", angle);
  BLEState.calibrationCharacteristic.writeValue(buffer).catch(error => {
    console.error("Error sending angle:", error);
    alert("Failed to send angle to Arduino. Please check the connection.");
    BLEState.isConnected = false;
  });
}

function updateBLEDistance(isNearTower) {
  if (!BLEState.isConnected) {
    console.log("Not connected to Arduino");
    return;
  }

  if (BLEState.distanceCharacteristic) {
    BLEState.myBLE.write(
      BLEState.distanceCharacteristic,
      isNearTower ? "1" : "0"
    ).catch(error => {
      console.error("Error updating distance:", error);
      alert("Failed to update distance on Arduino. Please check the connection.");
      BLEState.isConnected = false;
    });
  }
}

function resetDevice() {
  if (!BLEState.isConnected) {
    alert("Not connected to Arduino. Please connect first.");
    return;
  }

  if (BLEState.resetCharacteristic) {
    console.log("Sending reset signal to device");
    // Send a single byte (1) to trigger reset
    let buffer = new ArrayBuffer(1);
    let view = new DataView(buffer);
    view.setUint8(0, 1);
    BLEState.resetCharacteristic.writeValue(buffer).catch(error => {
      console.error("Error resetting device:", error);
      alert("Failed to reset Arduino. Please check the connection.");
      BLEState.isConnected = false;
    });
  } else {
    console.log("Device not connected or reset characteristic not available");
    alert("Reset characteristic not available. Please reconnect to Arduino.");
  }
}

function restartSession() {
  if (!BLEState.isConnected) {
    alert("Not connected to Arduino. Please connect first.");
    return;
  }

  if (!BLEState.restartSessionCharacteristic) {
    alert("Restart session characteristic not available. Please reconnect to Arduino.");
    return;
  }

  console.log("Restarting session...");

  // Find a new tower based on current mode (random or closest)
  if (window.GPSState && window.GPSState.currentLat !== 0 && window.GPSState.currentLon !== 0) {
    const newTower = window.GPSState.isRandom ? 
      window.findOneRandomTower() : 
      window.findClosestTower(window.GPSState.currentLat, window.GPSState.currentLon);
    
    if (newTower) {
      window.GPSState.closestTower = newTower;
      
      // Recalculate angle to new tower
      if (window.CompassState) {
        window.CompassState.angleToTower = window.calculateAngleToTower(
          window.GPSState.currentLat,
          window.GPSState.currentLon,
          newTower.tower.lat,
          newTower.tower.lon
        );
      }
      
      // Update UI with new tower info
      if (window.onLocationUpdate) {
        window.onLocationUpdate({
          position: { lat: window.GPSState.currentLat, lon: window.GPSState.currentLon },
          tower: newTower.tower,
          distance: newTower.distance.toFixed(2),
          angle: window.CompassState.angleToTower
        });
      }
      
      // Send signal (1) to hardware to go back to "waiting for calibration" state
      let buffer = new ArrayBuffer(2);
      let view = new DataView(buffer);
      view.setUint16(0, 1, true);  // Just send 1 as signal
      
      BLEState.restartSessionCharacteristic.writeValue(buffer)
        .then(() => {
          console.log("Session reset. New tower selected. Please calibrate to start.");
          alert("New tower selected! Face north and press Calibrate to start.");
        })
        .catch(error => {
          console.error("Error restarting session:", error);
          alert("Failed to restart session. Please check the connection.");
        });
    } else {
      alert("No tower found. Please check your location.");
    }
  } else {
    alert("GPS position not available. Please wait for GPS lock.");
  }
}

// Export functions for global access
window.resetDevice = resetDevice;
window.restartSession = restartSession;
window.BLEState = BLEState;
