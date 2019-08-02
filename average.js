const { heartrate, watts, cadence } = require(process.argv[2]);
let heartrateSum = 0;
let wattsSum = 0;
let cadenceSum = 0;
let start = process.argv[3] * 60;
let end = process.argv[4] * 60;
for (let i = start; i < end; i++) {
  heartrateSum += heartrate[i];
  wattsSum += watts[i];
  cadenceSum += cadence[i];
}
const duration = end - start;
console.log(
  heartrateSum / duration,
  wattsSum / duration,
  cadenceSum / duration
);
