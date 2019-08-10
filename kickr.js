const { getDevice, autoReconnectSubscription } = require("./ble-device");
const { Transform } = require("stream");

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

const encodePowerCommand = power =>
  Buffer.from([0x42, power & 0xff, (power >> 8) & 0xff]);

const connectToKickr = cb => {
  getDevice("1818", (err, peripheral) => {
    if (err) {
      process.exit(1);
    }

    const onConnect = (characteristics, cb) => {
      console.error("Unlocking");
      const unlockCharacteristic = characteristics.find(
        x => x.uuid === "a026e0020a7d4ab397faf1500f9feb8b"
      );

      const trainerCharacteristic = characteristics.find(
        x => x.uuid === "a026e0050a7d4ab397faf1500f9feb8b"
      );

      // It appears that power control writes will not take affect unless
      // a) we subscribe to the trainer characteristic
      // b) we write the correct code to the unlock characteristic
      trainerCharacteristic.subscribe(err => {
        if (err) {
          return cb(err);
        }
        unlockCharacteristic.write(Buffer.from([0x20, 0xee, 0xfc]), true, cb);
      });
    };

    autoReconnectSubscription(
      peripheral,
      onConnect,
      "2a63",
      "a026e0050a7d4ab397faf1500f9feb8b",
      (err, measure, control) => {
        if (err) {
          return cb(err);
        }

        const deserializeMeasure = new Transform({
          readableObjectMode: true,
          transform: (x, _, callback) => {
            callback(null, parsePowerMeasure(x));
          }
        });

        const serializeControl = new Transform({
          writableObjectMode: true,
          readableObjectMode: false,
          transform: (x, _, cb) => {
            cb(null, encodePowerCommand(x));
          }
        });

        // Note that pipe returns the destination,
        // so we must instead return the serializeControl,
        // since returning the control stream
        // would not include the transform
        serializeControl.pipe(control);

        cb(null, measure.pipe(deserializeMeasure), serializeControl);
      }
    );
  });
};

module.exports = {
  connectToKickr
};
