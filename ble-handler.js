// BLE Configuration
const BLEConfig = {
  serviceUUID: "19B10010-E8F2-537E-4F6C-D104768A1214",
  characteristicUUID: "19b10011-e8f2-537e-4f6c-d104768a1214",
  calibrationCharacteristicUUID: "49c29251-5fe3-4832-83dd-e736b673b0bf",
  distanceCharacteristicUUID: "49c29252-5fe3-4832-83dd-e736b673b0bf",
};

// BLE State
const BLEState = {
  myBLE: null,
  myCharacteristic: null,
  calibrationCharacteristic: null,
  distanceCharacteristic: null,
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
        characteristics: [BLEConfig.characteristicUUID],
      },
    ],
  });
}

function gotValue(error, value) {
  if (error) {
    console.log("error: ", error);
    return;
  }

  const data = new Float32Array(value.buffer);
  console.log("get data from ble: ", data);
}

function connectToBLE() {
  BLEState.myBLE.connect(BLEConfig.serviceUUID, gotCharacteristics, {
    filters: [
      {
        services: [BLEConfig.serviceUUID],
        characteristics: [BLEConfig.characteristicUUID],
      },
    ],
  });
}

function gotCharacteristics(error, characteristics) {
  if (error) {
    console.log("error: ", error);
    return;
  }

  BLEState.myCharacteristic = characteristics.find(
    (c) => c.uuid === BLEConfig.characteristicUUID
  );
  BLEState.calibrationCharacteristic = characteristics.find(
    (c) => c.uuid === BLEConfig.calibrationCharacteristicUUID
  );

  BLEState.distanceCharacteristic = characteristics.find(
    (c) => c.uuid === BLEConfig.distanceCharacteristicUUID
  );

  BLEState.isConnected = true;

  // When connecting to the device
  BLEState.myCharacteristic.startNotifications().then(() => {
    BLEState.myCharacteristic.addEventListener(
      "characteristicvaluechanged",
      onCharacteristicValueChanged
    );
  });
}

function writeToBle() {
  const inputValue = "gg";
  BLEState.myBLE.write(clibrationCharacteristic, inputValue);
}

function gotCharacteristics(error, characteristics) {
  if (error) {
    console.log("BLE Error:", error);
    return;
  }

  BLEState.myCharacteristic = characteristics.find(
    (c) => c.uuid === BLEConfig.characteristicUUID
  );
  BLEState.calibrationCharacteristic = characteristics.find(
    (c) => c.uuid === BLEConfig.calibrationCharacteristicUUID
  );
  BLEState.distanceCharacteristic = characteristics.find(
    (c) => c.uuid === BLEConfig.distanceCharacteristicUUID
  );
  BLEState.isConnected = true;

  // Start notifications
  BLEState.myCharacteristic.startNotifications().then(() => {
    BLEState.myCharacteristic.addEventListener(
      "characteristicvaluechanged",
      onCharacteristicValueChanged
    );
  });
}

// Calibrate the BLE device and send the angle to the device
function calibrateBLE() {
  if (BLEState.calibrationCharacteristic) {
    let angle = Math.round(CompassState.angleToTower);
    // Create an ArrayBuffer of 2 bytes.
    let buffer = new ArrayBuffer(2);
    let view = new DataView(buffer);
    view.setUint16(0, angle, true);
    // Write the value to the BLE characteristic.
    // Cannot use BLEState.myBLE.write as p5.ble can only send strings or 8bit data
    BLEState.calibrationCharacteristic.writeValue(buffer);
  }
}

function updateBLEDistance(isNearTower) {
  if (BLEState.distanceCharacteristic) {
    BLEState.myBLE.write(
      BLEState.distanceCharacteristic,
      isNearTower ? "1" : "0"
    );
  }
}

function onCharacteristicValueChanged(event) {
  const data = new Float32Array(event.target.value.buffer);
  const [xAcc, yAcc, zAcc, xGyro, yGyro, zGyro] = data;

  // Emit event or callback for sensor data update
  if (window.onSensorDataUpdate) {
    window.onSensorDataUpdate({
      accelerometer: { x: xAcc, y: yAcc, z: zAcc },
      gyroscope: { x: xGyro, y: yGyro, z: zGyro },
    });
  }
}
