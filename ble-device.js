const noble = require("noble");
const { Readable } = require("stream");

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

const _autoReconnectSubscription = (peripheral, charUuid, stream, cb) => {
  peripheral.connect(err => {
    if (err) {
      return cb(err);
    }

    peripheral.once("disconnect", () => {
      log("Connection dropped!");
      _autoReconnectSubscription(peripheral, charUuid, stream, () => {});
    });

    log("Connected!");
    peripheral.discoverAllServicesAndCharacteristics(
      (err, services, characteristics) => {
        log("Services and Characteristics Discovered");

        const c = characteristics.find(x => x.uuid === charUuid);

        c.subscribe(err => {
          if (err) {
            log("Could not subscribe to characteristic!");
            cb(err);
          } else {
            log("Subscribed to characteristic");
            c.on("data", x => stream.push(x));
            cb();
          }
        });
      }
    );
  });
};

const autoReconnectSubscription = (peripheral, charUuid, cb) => {
  const stream = new Readable({
    read: function() {}
  });

  _autoReconnectSubscription(peripheral, charUuid, stream, err => {
    cb(err, stream);
  });
};
