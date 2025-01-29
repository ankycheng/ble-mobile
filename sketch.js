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

function setup() {
  createCanvas(400, 400);
  myBLE = new p5ble();

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

  initLogTracker();
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

function onCharacteristicValueChanged(event) {
  const value = new Float32Array(event.target.value.buffer);
  console.log("value: ", value);
  heading, pitch, (roll = value);
}
