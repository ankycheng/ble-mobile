// BLE Configuration
const BLEConfig = {
  serviceUUID: "19B10010-E8F2-537E-4F6C-D104768A1214",
  calibrationCharacteristicUUID: "49c29251-5fe3-4832-83dd-e736b673b0bf",
  distanceCharacteristicUUID: "49c29252-5fe3-4832-83dd-e736b673b0bf",
  resetCharacteristicUUID: "49c29254-5fe3-4832-83dd-e736b673b0bf",
};

// BLE State
const BLEState = {
  myBLE: null,
  calibrationCharacteristic: null,
  distanceCharacteristic: null,
  resetCharacteristic: null,
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

  BLEState.isConnected = true;

  // setInterval(() => updateBLEDistance(true), 5000);
}

// Calibrate the BLE device and send the angle to the device
function calibrateBLE() {
  if (BLEState.calibrationCharacteristic) {
    sendAngleToBLE(CompassState.angleToTower);
  }
}

function sendAngleToBLE(angle) {
  angle = Math.round(angle);
  // Create an ArrayBuffer of 2 bytes.
  let buffer = new ArrayBuffer(2);
  let view = new DataView(buffer);
  view.setUint16(0, angle, true);
  // Cannot use BLEState.myBLE.write as p5.ble can only send strings or 8bit data
  console.log("write angle to ble: ", angle);
  BLEState.calibrationCharacteristic.writeValue(buffer);
}

function updateBLEDistance(isNearTower) {
  if (BLEState.distanceCharacteristic) {
    BLEState.myBLE.write(
      BLEState.distanceCharacteristic,
      isNearTower ? "1" : "0"
    );
  }
}

function resetDevice() {
  if (BLEState.resetCharacteristic && BLEState.isConnected) {
    console.log("Sending reset signal to device");
    // Send a single byte (1) to trigger reset
    let buffer = new ArrayBuffer(1);
    let view = new DataView(buffer);
    view.setUint8(0, 1);
    BLEState.resetCharacteristic.writeValue(buffer);
  } else {
    console.log("Device not connected or reset characteristic not available");
  }
}

// Export functions for global access
window.resetDevice = resetDevice;
