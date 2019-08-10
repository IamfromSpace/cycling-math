const noble = require("noble");
const { Record, toFileBuffer } = require("./write-fit.js");
const { connectToHrm } = require("./hrm");
const { connectToKickr } = require("./kickr");
const { connectToCadence } = require("./cadence");

const log = (...rest) => console.error(new Date(), ...rest);

const isRepeatCadenceData = (a, b) => a.crankRevolutions == b.crankRevolutions;

const queueMaker = () => {
  let lastPower = null;
  const data = {
    hr: [],
    cadence: [],
    power: []
  };
  return {
    putPower: ({ instantaneousPower }) => {
      data.power.push(instantaneousPower);
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
        // Strava doesn't interpolate power, so we'll assume it was constant
        // if we didn't get one this tick
        data.power.length ? average(data.power) : lastPower,
        data.hr.length ? average(data.hr) : null,
        data.cadence.length > 1 ? averageCadence(data.cadence) : null
      );

      data.hr = [];
      data.cadence =
        data.cadence.length > 0 ? [data.cadence[data.cadence.length - 1]] : [];
      data.power = [];

      lastPower = record.power;

      return record;
    }
  };
};

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
  require("fs").writeFileSync(
    "workout_" + new Date().getTime() + ".fit",
    toFileBuffer(records)
  );
  log("Done! Exiting now.");
  process.exit();
});

connectToHrm((err, hrStream) => {
  if (err) {
    log("couldn't connect to HRM!", err);
    process.exit(1);
  }

  log("HRM connected!");
  hrStream.on("data", putHr);

  connectToKickr((err, powerStream, powerControl) => {
    if (err) {
      log("couldn't connect to KICKR!", err);
      process.exit(1);
    }

    log("KICKR connected!");
    powerStream.on("data", putPower);
    powerControl.write(80);

    connectToCadence((err, cadenceStream) => {
      if (err) {
        log("couldn't connect to Cadence!", err);
        process.exit(1);
      }

      log("Cadence Meter connected!");
      cadenceStream.on("data", putCadence);
    });
  });
});

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
