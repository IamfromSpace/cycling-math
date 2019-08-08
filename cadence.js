const { getDevice, autoReconnectSubscription } = require("./ble-device");
const { Transform } = require("stream");

// To get the actual cadence, two records must be compared.
// 60 / (lastCrankEventTime1 - lastCrankEventTime2)
// and lastCrankEventTime will constantly be overflowing
const parseCadence = buffer => {
  return {
    crankRevolutions: buffer[1] + (buffer[2] << 8),
    lastCrankEventTime: (buffer[3] + (buffer[4] << 8)) / 1024
  };
};

const connectToCadence = cb => {
  getDevice("1816", (err, peripheral) => {
    if (err) {
      process.exit(1);
    }

    const onConnect = (_, cb) => cb();

    autoReconnectSubscription(
      peripheral,
      onConnect,
      "2a5b",
      null,
      (err, cadence) => {
        if (err) {
          return cb(err);
        }

        const deserializeCadence = new Transform({
          readableObjectMode: true,
          transform: (x, _, callback) => {
            callback(null, parseCadence(x));
          }
        });

        cb(null, cadence.pipe(deserializeCadence));
      }
    );
  });
};

module.exports = {
  connectToCadence
};
