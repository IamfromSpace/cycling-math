const { getDevice, autoReconnectSubscription } = require("./ble-device");
const { Transform } = require("stream");

const parseHr = buffer => {
  const isEightBit = !(buffer[0] & 1);
  return {
    hr: buffer[1],
    rrInterval: (buffer[2] + (buffer[3] << 8)) / 1024
  };
};

const connectToHrm = cb => {
  getDevice("180d", (err, peripheral) => {
    if (err) {
      process.exit(1);
    }

    const onConnect = (_, cb) => cb();

    autoReconnectSubscription(
      peripheral,
      onConnect,
      "2a37",
      null,
      (err, hr) => {
        if (err) {
          return cb(err);
        }

        const deserializeHr = new Transform({
          readableObjectMode: true,
          transform: (x, _, callback) => {
            callback(null, parseHr(x));
          }
        });

        cb(null, hr.pipe(deserializeHr));
      }
    );
  });
};

module.exports = {
  connectToHrm
};
