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
  // createCanvas(400, 400)
  createCanvas(500, 600, WEBGL); // make the canvas

  myBLE = new p5ble();

  const connectButton = createButton("Connect to Arduino");
  connectButton.mousePressed(connectToBLE);

  // Create a text input
  // input = createInput();

  const calibrateButton = createButton("Calibrate");
  calibrateButton.mousePressed(calibrate);

  // Create a 'Write' button
  // const writeButton = createButton("Write");
  // writeButton.mousePressed(writeToBle);

  (function () {
    var old = console.log;
    var logger = document.getElementById("log");
    console.log = function (message) {
      if (typeof message == "object") {
        logger.innerHTML +=
          (JSON && JSON.stringify ? JSON.stringify(message) : message) +
          "<br />";
      } else {
        logger.innerHTML += message + "<br />";
      }
    };
  })();
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
  console.log(characteristics);
  myCharacteristic = characteristics.find((c) => c.uuid === characteristicUUID);
  clibrationCharacteristic = characteristics.find(
    (c) => c.uuid === clibrationCharacteristicUUID
  );
  isConnected = true;

  // Start reading the orientation data
  // myBLE.read(myCharacteristic, gotValue);

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

  // Parse the incoming data string
  // console.log("value: ", value);
  // let values = value.split(",");
  // if (values.length === 3) {
  //   heading = parseFloat(values[0]);
  //   pitch = parseFloat(values[1]);
  //   roll = parseFloat(values[2]);
  // }
  const data = new Float32Array(value.buffer);
  const [xAcc, yAcc, zAcc, xGyro, yGyro, zGyro] = data;
  console.log("Accelerometer:", { xAcc, yAcc, zAcc });
  console.log("Gyroscope:", { xGyro, yGyro, zGyro });
  // Continue reading
  myBLE.read(myCharacteristic, gotValue);
}

function writeToBle() {
  const inputValue = input.value();
  // myBLE.write(myCharacteristic, inputValue);
  myBLE.write(clibrationCharacteristic, inputValue);
}

function calibrate() {
  alert("Calibrating");
  myBLE.write(clibrationCharacteristic, "1");
}

function draw() {
  // update the drawing:
  background(255); // set background to white
  // push(); // begin object to draw

  // // variables for matrix translation:
  // let c1 = cos(radians(roll));
  // let s1 = sin(radians(roll));
  // let c2 = cos(radians(pitch));
  // let s2 = sin(radians(pitch));
  // let c3 = cos(radians(heading));
  // let s3 = sin(radians(heading));
  // applyMatrix(
  //   c2 * c3,
  //   s1 * s3 + c1 * c3 * s2,
  //   c3 * s1 * s2 - c1 * s3,
  //   0,
  //   -s2,
  //   c1 * c2,
  //   c2 * s1,
  //   0,
  //   c2 * s3,
  //   c1 * s2 * s3 - c3 * s1,
  //   c1 * c3 + s1 * s2 * s3,
  //   0,
  //   0,
  //   0,
  //   0,
  //   1
  // );

  // // draw arduino board:
  // drawArduino();
  // pop(); // end of object
}

// draws the Arduino Nano:
function drawArduino() {
  // the base board:
  stroke(0, 90, 90); // set outline color to darker teal
  fill(0, 130, 130); // set fill color to lighter teal
  box(300, 10, 120); // draw Arduino board base shape

  // the CPU:
  stroke(0); // set outline color to black
  fill(80); // set fill color to dark grey
  translate(30, -6, 0); // move to correct position
  box(60, 0, 60); // draw box

  // the radio module:
  stroke(80); // set outline color to grey
  fill(180); // set fill color to light grey
  translate(80, 0, 0); // move to correct position
  box(60, 15, 60); // draw box

  // the USB connector:
  translate(-245, 0, 0); // move to correct position
  box(35, 15, 40); // draw box
}

// function draw() {
//   background(250);
//   textSize(20);
//   text("Status: " + (isConnected ? "Connected" : "Not connected"), 20, 50);

//   if (isConnected) {
//     text(`Heading: ${heading.toFixed(1)}°`, 20, 100);
//     text(`Pitch: ${pitch.toFixed(1)}°`, 20, 140);
//     text(`Roll: ${roll.toFixed(1)}°`, 20, 180);
//   }
// }

// In your p5.js code
function onCharacteristicValueChanged(event) {
  // // When you uncomment the binary IMU data sending in Arduino, use this code instead:
  const value = new Float32Array(event.target.value.buffer);
  console.log("value: ", value);
  heading, pitch, (roll = value);

  // // Update your orientation variables
  // // You might need to implement your own orientation calculation based on accelerometer/gyro data
  // heading = (Math.atan2(yAcc, xAcc) * 180) / Math.PI;
  // pitch =
  //   (Math.atan2(-xAcc, Math.sqrt(yAcc * yAcc + zAcc * zAcc)) * 180) / Math.PI;
  // roll = (Math.atan2(yAcc, zAcc) * 180) / Math.PI;

  // console.log("Accelerometer:", { xAcc, yAcc, zAcc });
  // console.log("Gyroscope:", { xGyro, yGyro, zGyro });
}
