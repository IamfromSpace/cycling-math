const noble = require("noble");
const { Record, toFileBuffer } = require("./write-fit.js");

const log = (...rest) => console.error(new Date(), ...rest);

const isRepeatCadenceData = (a, b) => a.crankRevolutions == b.crankRevolutions;

const queueMaker = () => {
  let lastPower;
  const data = {
    hr: [],
    cadence: [],
    power: []
  };
  return {
    putPower: ({ instantaneousPower }) => {
      data.power.push(instantaneousPower);
      lastPower = instantaneousPower;
    },
    putHr: ({ rrInterval }) =>
      isFinite(rrInterval) && data.hr.push(60 / rrInterval),
    putCadence: record => {
      if (
        data.cadence.length == 0 ||
        !isRepeatCadenceData(data.cadence[data.cadence.length - 1], record)
      ) {
        data.cadence.push(record);
      }
    },
    pullRecord: dateTime => {
      const record = Record(
        dateTime,
        data.power.length ? average(data.power) : null,
        // Strava doesn't interpolate power, so we'll assume it was constant
        // if we didn't get one this tick
        data.hr.length ? average(data.hr) : lastPower,
        data.cadence.length > 1 ? averageCadence(data.cadence) : null
      );
      data.hr = [];
      data.cadence =
        data.cadence.length > 0 ? [data.cadence[data.cadence.length - 1]] : [];
      data.power = [];
      return record;
    }
  };
};

const POWER_SERVICE_ID = "1818";
const HR_SERVICE_ID = "180d";
const CADENCE_SERVICE_ID = "1816";

noble.once("stateChange", state => {
  log("Received new state:", state);
  if (state == "poweredOn") {
    log("Starting Scan for KICKR");
    noble.startScanning([POWER_SERVICE_ID]);
  } else {
    log("First change was not power on!  Please restart");
    process.exit(1);
  }
});

const { putHr, putPower, putCadence, pullRecord } = queueMaker();

const records = [];
setInterval(() => {
  const record = pullRecord(new Date());
  log("Got Record", record);
  records.push(record);
}, 997);

process.on("SIGINT", () => {
  // TODO: Disconnect from all devices

  log("Writing FIT file before close...");
  require("fs").writeFileSync("workout.fit", toFileBuffer(records));
  log("Done! Exiting now.");
  process.exit();
});

noble.on("discover", peripheral => {
  if (peripheral.advertisement.serviceUuids.indexOf(POWER_SERVICE_ID) >= 0) {
    log("Found KICKR");
    noble.stopScanning(() => {
      log("Starting Scan for HRM");
      noble.startScanning([HR_SERVICE_ID]);
    });
    handleKickr(peripheral, putPower);
  }

  if (peripheral.advertisement.serviceUuids.indexOf(HR_SERVICE_ID) >= 0) {
    log("Found HR monitor");
    noble.stopScanning(() => {
      log("Starting Scan for Cadence Meten");
      noble.startScanning([CADENCE_SERVICE_ID]);
    });
    handleHrMonitor(peripheral, putHr);
  }

  if (peripheral.advertisement.serviceUuids.indexOf(CADENCE_SERVICE_ID) >= 0) {
    log("Found Cadence meter");
    log("Found all devices");
    noble.stopScanning();
    handleCadenceMeter(peripheral, putCadence);
  }
});

const handleHrMonitor = (peripheral, put) => {
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
              put(parseHrm(data));
            });
          }
        });
      }
    );
  });
};

const handleCadenceMeter = (peripheral, put) => {
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
              put(parseCadence(data));
            });
          }
        });
      }
    );
  });
};

const handleKickr = (peripheral, put) => {
  peripheral.connect(err => {
    if (err) {
      log("Could not connect to KICKR!", err);
      process.exit();
    }

    log("Connected to KICKR");
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
              put(parsePowerMeasure(data));
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

const average = list => list.reduce((a, b) => a + b, 0) / list.length;

const calcCadence = (a, b) => {
  if (a == b) {
    return null;
  }
  const duration =
    b.lastCrankEventTime > a.lastCrankEventTime
      ? b.lastCrankEventTime - a.lastCrankEventTime
      : Math.pow(2, 6) + b.lastCrankEventTime - a.lastCrankEventTime;

  // This only overflows at like 11hrs of 100rpm, but it can happen!
  const totalRevolutions =
    b.crankRevolutions > a.crankRevolutions
      ? b.crankRevolutions - a.crankRevolutions
      : Math.pow(2, 16) + b.crankRevolutions - a.crankRevolutions;
  return totalRevolutions * 60 / duration;
};

const averageCadence = list => {
  const x = [];
  for (i = 1; i < list.length; i++) {
    x.push(calcCadence(list[i - 1], list[i]));
  }
  return average(x);
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
