const noble = require("noble");
const { Readable, Writable } = require("stream");

const log = (...rest) => console.error(new Date(), ...rest);

const getDevice = (uuid, cb) => {
  if (noble.state != "poweredOn") {
    return noble.once("stateChange", () => {
      getDevice(uuid, cb);
    });
  }

  log("Starting Scan");
  noble.startScanning([uuid]);

  noble.once("discover", peripheral => {
    log("Peripheral found");
    noble.stopScanning(err => {
      log("Scan ended");
      cb(err, peripheral);
    });
  });

  // TODO: possible errors here are that scanning
  // stops or the adapter powers down
};

const _autoReconnectSubscription = (
  peripheral,
  onConnect,
  charUuid,
  readStream,
  writeUuid,
  writeStream,
  cb
) => {
  log("Connecting!");
  peripheral.connect(err => {
    if (err) {
      log("Failed to connect!");
      return cb(err);
    }

    log("Connected!");
    // TODO: it appears that this sometimes just hangs
    peripheral.discoverAllServicesAndCharacteristics(
      (err, _, characteristics) => {
        if (err) {
          log("Could not discover services and characteristics!");
          return cb(err);
        }

        log("Services and Characteristics Discovered");
        onConnect(characteristics, err => {
          if (err) {
            log("onConnect hook failed!");
            return cb(err);
          }

          log("onConnect hook success");
          const c = characteristics.find(x => x.uuid === charUuid);

          c.subscribe(err => {
            if (err) {
              log("Could not subscribe to characteristic!");
              return cb(err);
            }

            log("Subscribed to characteristic");
            c.on("data", x => readStream.push(x));

            if (writeStream) {
              const wc = characteristics.find(x => x.uuid == writeUuid);
              writeStream.characteristic = wc;
              writeStream.uncork();
            }

            peripheral.once("disconnect", () => {
              writeStream && writeStream.cork();
              log("Connection dropped!");
              setTimeout(() => {
                _autoReconnectSubscription(
                  peripheral,
                  onConnect,
                  charUuid,
                  readStream,
                  writeUuid,
                  writeStream,
                  () => {}
                );
              }, 1000);
            });

            cb();
          });
        });
      }
    );
  });
};

const autoReconnectSubscription = (
  peripheral,
  onConnect,
  charUuid,
  writeUuid,
  cb
) => {
  const readStream = new Readable({
    read: function() {}
  });

  let writeStream;
  if (writeUuid) {
    writeStream = new Writable({
      write: function(buffer, _, cb) {
        // TODO: best way to handle withoutResponse?
        this.characteristic.write(buffer, false, cb);
      }
    });

    writeStream.cork();
  }

  _autoReconnectSubscription(
    peripheral,
    onConnect,
    charUuid,
    readStream,
    writeUuid,
    writeStream,
    err => {
      cb(err, readStream, writeStream);
    }
  );
};

module.exports = {
  getDevice,
  autoReconnectSubscription
};
