const EasyFit = require("easy-fit").default;
const { Record, toFileBuffer } = require("./write-fit.js");

var fs = require("fs");

const easyFitRecordToRecord = record =>
  Record(record.timestamp, record.power, record.heart_rate, record.cadence);

const readFitFile = (fileName, fitOptions) =>
  new Promise((res, rej) => {
    fs.readFile(fileName, function(err, content) {
      if (err) {
        rej(err);
      } else {
        var easyFit = new EasyFit(fitOptions);

        easyFit.parse(content, function(error, data) {
          if (error) {
            rej(error);
          } else {
            res(data);
          }
        });
      }
    });
  });

const concat = list => {
  const r = [];
  for (i = 0; i < list.length; i++) {
    for (j = 0; j < list[i].length; j++) {
      r.push(list[i][j]);
    }
  }
  return r;
};

const stitch = (fileNameList, outPutName) => {
  // Note, we want options to be undefined, not the index
  Promise.all(fileNameList.map(x => readFitFile(x))).then(fitList => {
    const records = concat(fitList.map(x => x.records)).map(
      easyFitRecordToRecord
    );
    fs.writeFileSync(outPutName, toFileBuffer(records));
  });
};

/* example usage:
stitch(
  [
    "workout_1565478473565.fit",
    "workout_1565478585221.fit",
    "workout_1565478644389.fit",
    "workout_1565478667315.fit",
    "workout_1565478908025.fit",
    "workout_1565480395304.fit",
    "workout_1565480443677.fit",
    "workout_1565481127692.fit"
  ],
  "workout_1565481127692_fixed.fit"
);
*/
