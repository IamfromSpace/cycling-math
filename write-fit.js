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
    0,
    // profile version (little endian)
    0,
    0,
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
  return Buffer.from([
    0,
    // Time
    ts & 0xff,
    (ts >> 8) & 0xff,
    (ts >> 16) & 0xff,
    (ts >> 24) & 0xff,
    // Power
    record.power & 0xff,
    (record.power >> 8) & 0xff,
    // heartRate
    record.heartRate & 0xff,
    // cadence
    record.cadence & 0xff
  ]);
};

const recordDef = record => {
  return Buffer.from([
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
    4,
    // Timestamp (field definition number, byte count, default type (u32))
    253,
    4,
    0x86,
    // Power (field definition number, byte count, default type (u16))
    7,
    2,
    0x84,
    // HeartRate (field definition number, byte count, default type (u8))
    3,
    1,
    2,
    // Cadence (field definition number, byte count, default type (u8))
    4,
    1,
    2
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

const toFileBuffer = recordList => {
  const withoutChecksum = Buffer.concat([
    makeHeader(18 + recordList.length * 9),
    recordDef(),
    Buffer.concat(recordList.map(recordToBytes))
  ]);
  const crc = calculateCrc(withoutChecksum);
  return Buffer.concat([
    withoutChecksum,
    Buffer.from([crc & 0xff, (crc >> 8) & 0xff])
  ]);
};
