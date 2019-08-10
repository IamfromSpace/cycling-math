const runWorkout = (setPower, xs) => {
  xs.reduce((runningTotal, { duration, power }) => {
    setTimeout(() => setPower(power), runningTotal * 1000);
    return runningTotal + duration;
  }, 0);
};

const repeat = (xs, n) => {
  let list = [];
  for (i = 0; i < n; i++) {
    list = list.concat(xs);
  }
  return list;
};

const BigStartIntervalsWorkout = ({
  highPower,
  lowPower,
  warmUpPower,
  tailPower,
  intervalCount,
  firstDuration,
  highDuration,
  lowDuration,
  warmUpDuration
}) => {
  const warmUp = {
    duration: warmUpDuration,
    power: warmUpPower
  };
  const bigStart = {
    duration: firstDuration,
    power: highPower
  };
  const low = {
    duration: lowDuration,
    power: lowPower
  };
  const typicalInterval = [
    low,
    {
      duration: highDuration,
      power: highPower
    }
  ];
  const coolDown = [
    low,
    {
      duration: 0,
      power: tailPower
    }
  ];

  return [warmUp].concat(
    [bigStart],
    repeat(typicalInterval, intervalCount - 1),
    coolDown
  );
};

module.exports = {
  runWorkout,
  BigStartIntervalsWorkout
};
