const Record = (dateTime, power, heartRate, cadence) => ({
  dateTime,
  power,
  heartRate,
  cadence
});

const makeHeader = length => {
  return Buffer.from([
    // Header length
    12,
    // protocol version
    0x20,
    // profile version (little endian)
    0xeb,
    0x07,
    // number of bytes excluding header and checksum (little endian)
    length & 0xff,
    (length >> 8) & 0xff,
    (length >> 16) & 0xff,
    (length >> 24) & 0xff,
    // ASCI for .FIT
    0x2e,
    0x46,
    0x49,
    0x54
  ]);
};

const recordToBytes = record => {
  const ts = Math.floor(record.dateTime.getTime() / 1000) - 631065600;
  const bytes = [
    0,
    // Time
    ts & 0xff,
    (ts >> 8) & 0xff,
    (ts >> 16) & 0xff,
    (ts >> 24) & 0xff
  ];

  if (record.power != null) {
    const roundedPower = Math.round(record.power);
    bytes.push(roundedPower & 0xff);
    bytes.push((roundedPower >> 8) & 0xff);
  }

  if (record.heartRate != null) {
    bytes.push(Math.round(record.heartRate) & 0xff);
  }

  if (record.cadence != null) {
    bytes.push(Math.round(record.cadence) & 0xff);
  }

  return Buffer.from(bytes);
};

const recordDef = record => {
  const base = Buffer.from([
    // Field definition for message type 0
    64,
    // Reserved
    0,
    // Little Endian
    0,
    // Global Message Number (20 is for a typical data record)
    20,
    0,
    // Number of fields
    1 +
      (record.power != null) +
      (record.heartRate != null) +
      (record.cadence != null),
    // Timestamp (field definition number, byte count, default type (u32))
    253,
    4,
    0x86
  ]);
  const powerDef = [
    // Power (field definition number, byte count, default type (u16))
    7,
    2,
    0x84
  ];
  const hrDef = [
    // HeartRate (field definition number, byte count, default type (u8))
    3,
    1,
    2
  ];
  const cadenceDef = [
    // Cadence (field definition number, byte count, default type (u8))
    4,
    1,
    2
  ];

  return Buffer.concat([
    base,
    Buffer.from(record.power != null ? powerDef : []),
    Buffer.from(record.heartRate != null ? hrDef : []),
    Buffer.from(record.cadence != null ? cadenceDef : [])
  ]);
};

calculateCrc = blob => {
  const crcTable = [
    0x0000,
    0xcc01,
    0xd801,
    0x1400,
    0xf001,
    0x3c00,
    0x2800,
    0xe401,
    0xa001,
    0x6c00,
    0x7800,
    0xb401,
    0x5000,
    0x9c01,
    0x8801,
    0x4400
  ];

  let crc = 0;
  for (let i = 0; i < blob.length; i++) {
    const byte = blob[i];
    let tmp = crcTable[crc & 0xf];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ crcTable[byte & 0xf];
    tmp = crcTable[crc & 0xf];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ crcTable[(byte >> 4) & 0xf];
  }

  return crc;
};

const sameListValues = (a, b) => {
  if (a.length != b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] != b[i]) {
      return false;
    }
  }

  return true;
};

const recordsToBuffer = list => {
  const { buffers } = list.reduce(
    ({ lastDef, buffers }, next) => {
      const newDef = recordDef(next);
      if (lastDef) {
        if (!sameListValues(newDef, lastDef)) {
          buffers.push(newDef);
        }
      } else {
        buffers.push(newDef);
      }
      buffers.push(recordToBytes(next));
      return {
        buffers,
        lastDef: newDef
      };
    },
    { buffers: [] }
  );
  return Buffer.concat(buffers);
};

const toFileBuffer = recordList => {
  const recordBuffer = recordsToBuffer(recordList);
  const withoutChecksum = Buffer.concat([
    makeHeader(recordBuffer.length),
    recordBuffer
  ]);
  const crc = calculateCrc(withoutChecksum);
  return Buffer.concat([
    withoutChecksum,
    Buffer.from([crc & 0xff, (crc >> 8) & 0xff])
  ]);
};

module.exports = {
  Record,
  toFileBuffer
};
