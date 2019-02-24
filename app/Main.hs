module Main where

import           Lib

main :: IO ()
main = do
  --putStr $ unlines $ show <$> powersToBals fitness ...
  let fitness = (244.2, 21000)
  putStrLn "\nto attempt:"
  let toAttemptPowers = workoutToPowers (Workout 14 145 60 330 90 120)
  print $ length toAttemptPowers
  print $ last $ powersToBals fitness $ take 145 toAttemptPowers
  print $ last $ powersToBals fitness toAttemptPowers
  print $ xWPrime fitness toAttemptPowers
  putStrLn "\n4min/3min"
  let fourMinPowers = workoutToPowers (Workout 4 240 240 283 180 120)
  print $ last $ powersToBals fitness fourMinPowers
  print $ xWPrime fitness fourMinPowers
  putStrLn "\n15s/15s"
  let fifteenPowers = workoutToPowers (Workout 47 15 15 324 15 120)
  print $ last $ powersToBals fitness fifteenPowers
  print $ xWPrime fitness fifteenPowers
  putStrLn "\nHigh Torque"
  let highTorquePowers = workoutToPowers (Workout 7 30 30 500 230 60)
  --putStr $ unlines $ show <$> powersToBals fitness highTorquePowers
  print $ last $ powersToBals fitness highTorquePowers
  print $ xWPrime fitness highTorquePowers
  putStrLn "\nLowest Power"
  let lowestPower = workoutToPowers (Workout 10 220 90 300 90 120)
  --putStr $ unlines $ show <$> powersToBals fitness lowestPower
  print $ last $ powersToBals fitness $ take 220 lowestPower
  print $ last $ powersToBals fitness lowestPower
  print $ xWPrime fitness lowestPower
