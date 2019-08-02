const noble = require("noble");

let foundKickr = false;
let foundHrm = false;
let foundCadenceMeter = false;

const getIsDoneDiscovering = () => foundKickr && foundHrm && foundCadenceMeter;

const log = (...rest) => console.error(new Date(), ...rest);

noble.on("stateChange", state => {
  log("Received new state:", state);
  if (state == "poweredOn" && !getIsDoneDiscovering()) {
    log("Starting Scan");
    noble.startScanning(["1818", "180d", "1816"]);
  }
});

noble.on("discover", peripheral => {
  if (getIsDoneDiscovering()) {
    log("Done scanning.");
    noble.stopScanning();
  }

  if (peripheral.advertisement.serviceUuids.indexOf("1818") >= 0) {
    log("Found KICKR");
    foundKickr = true;
    handleKickr(peripheral);
  }

  if (peripheral.advertisement.serviceUuids.indexOf("180d") >= 0) {
    log("Found HR monitor");
    foundHrm = true;
    handleHrMonitor(peripheral);
  }

  if (peripheral.advertisement.serviceUuids.indexOf("1816") >= 0) {
    log("Found Cadence meter");
    foundCadenceMeter = true;
    handleCadenceMeter(peripheral);
  }
});

const handleHrMonitor = peripheral => {
  peripheral.connect(err => {
    if (err) {
      log("Could not connect to HRM!", err);
      process.exit();
    }

    log("Connected to HRM");
    peripheral.discoverAllServicesAndCharacteristics(
      (err, services, characteristics) => {
        log("Services and Characteristics Discovered");

        const hrmCharacteristic = characteristics.find(x => x.uuid === "2a37");
        hrmCharacteristic.subscribe(err => {
          if (err) {
            log("Could not subscribe to HRM!");
            process.exit();
          } else {
            log("Subscribed to heart rate data");
            hrmCharacteristic.on("data", data => {
              log("Heart Rate Measurement Event Received");
              log(data);
              log(parseHrm(data));
              log(60 / parseHrm(data).rrInterval);
            });
          }
        });
      }
    );
  });
};

const handleCadenceMeter = peripheral => {
  peripheral.connect(err => {
    if (err) {
      log("Could not connect to Cadence Meter!", err);
      process.exit();
    }

    log("Connected to Cadence Meter");
    peripheral.discoverAllServicesAndCharacteristics(
      (err, services, characteristics) => {
        log("Services and Characteristics Discovered");

        const cadenceCharacteristic = characteristics.find(
          x => x.uuid === "2a5b"
        );
        cadenceCharacteristic.subscribe(err => {
          if (err) {
            log("Could not subscribe to Cadence Meter!");
            process.exit();
          } else {
            log("Subscribed to heart rate data");
            cadenceCharacteristic.on("data", data => {
              log("Cadence Measurement Event Received");
              log(data);
              log(parseCadence(data));
            });
          }
        });
      }
    );
  });
};

const handleKickr = peripheral => {
  peripheral.connect(err => {
    if (err) {
      log("Could not connect to KICKR!", err);
      process.exit();
    }

    log("Connected to KICKR");

    process.on("SIGINT", () => {
      log("Disconnecting before exit...");

      peripheral.disconnect(err => {
        log(err ? "Failed to disconnect!" : "Disconnected from KICKR");
        process.exit();
      });

      setTimeout(() => {
        log("Did not disconnect in time, forcing exit");
        process.exit();
      }, 2000);
    });

    peripheral.discoverAllServicesAndCharacteristics(
      (err, services, characteristics) => {
        log("Services and Characteristics Discovered");

        const unlockCharacteristic = characteristics.find(
          x => x.uuid === "a026e0020a7d4ab397faf1500f9feb8b"
        );
        const powerCharacteristic = characteristics.find(
          x => x.uuid === "2a63"
        );
        const wahooCharacteristic = characteristics.find(
          x => x.uuid === "a026e0050a7d4ab397faf1500f9feb8b"
        );

        powerCharacteristic.subscribe(err => {
          if (err) {
            log("Could not subscribe to power data!");
          } else {
            log("Subscribed to power data");
            powerCharacteristic.on("data", data => {
              log("Power Measurement Event Received");
              log(parsePowerMeasure(data));
            });
          }
        });

        wahooCharacteristic.subscribe((err, data) => {
          log("Subscribed to Wahoo Characteristic (probably?)", err, data);

          wahooCharacteristic.on("data", data => {
            log("Wahoo Characteristic Event Received", data);
          });

          unlockCharacteristic.write(
            Buffer.from([0x20, 0xee, 0xfc]),
            false,
            (err, data) => {
              log("KICKR unlocked (probably?)", err, data);
              wahooCharacteristic.write(Buffer.from([0x42, 80, 0]), false, log);
            }
          );
        });
      }
    );
  });
};

const parsePowerMeasure = buffer => {
  const flags = (buffer[1] << 8) + buffer[0];
  // TODO: Doesn't consider flags at all
  return {
    instantaneousPower: (buffer[3] << 8) + buffer[2],
    accumulatedTorque: ((buffer[5] << 8) + buffer[4]) / 32,
    cumulativeWheelRevolutions:
      (buffer[8] << 24) + (buffer[8] << 16) + (buffer[7] << 8) + buffer[6],
    lastWheelEventDuration: ((buffer[10] << 8) + buffer[9]) / 2048
  };
};

const parseHrm = buffer => {
  const isEightBit = !(buffer[0] & 1);
  return {
    hr: buffer[1],
    rrInterval: (buffer[2] + (buffer[3] << 8)) / 1024
  };
};

// To get the actual cadence, two records must be compared.
// 60 / (lastCrankEventTime1 - lastCrankEventTime2)
// and lastCrankEventTime will constantly be overflowing
const parseCadence = buffer => {
  return {
    crankRevolutions: buffer[1] + (buffer[2] << 8),
    lastCrankEventTime: (buffer[3] + (buffer[4] << 8)) / 1024
  };
};
