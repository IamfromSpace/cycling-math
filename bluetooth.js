const noble = require("noble");

let doneDiscovering = false;
let ergLock = false;

const log = (...rest) => console.error(new Date(), ...rest);

noble.on("stateChange", state => {
  log("Received new state:", state);
  if (state == "poweredOn" && !doneDiscovering) {
    log("Starting Scan");
    noble.startScanning(["1818"]);
  }
});

noble.on("discover", peripheral => {
  doneDiscovering = true;
  noble.stopScanning();

  log("Found KICKR");
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
});

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
