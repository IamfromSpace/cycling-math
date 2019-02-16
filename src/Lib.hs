module Lib
    ( totalConsumed
    , wPrimeBals
    , xWPrime
    , workoutToPowers
    , workoutToBals
    ) where

import           Control.Monad (join)

nextBal :: Float -> Float -> Float -> Float -> Float
nextBal cp wPrime bal p =
  bal + (cp - p) * (if p > cp then 1 else (wPrime - bal) / wPrime)

wPrimeBals :: Float -> Float -> Float -> [Float] -> [Float]
wPrimeBals cp wPrime balInit =
  reverse . foldl (\bals p -> nextBal cp wPrime (head bals) p : bals) [balInit]

totalConsumed :: [Float] -> Float
totalConsumed (h:t) =
  fst $ foldl (\(runningTotal, previousBal) bal -> (runningTotal + max 0.0 (previousBal - bal), bal)) (0, h) t

xWPrime :: Float -> Float -> Int -> Int -> (Int, Float) -> (Int, Float) -> Float
xWPrime cp wPrime intervalCount firstDir standardDef restDef =
  (/ wPrime) $
    totalConsumed $
    workoutToBals cp wPrime intervalCount firstDir standardDef restDef

workoutToBals :: Float -> Float -> Int -> Int -> (Int, Float) -> (Int, Float) -> [Float]
workoutToBals cp wPrime intervalCount firstDir standardDef restDef =
  wPrimeBals cp wPrime wPrime $
    workoutToPowers intervalCount firstDir standardDef restDef

workoutToPowers :: Int -> Int -> (Int, Float) -> (Int, Float) -> [Float]
workoutToPowers intervalCount firstDir (standardDir, standardPower) (restDir, restPower) =
  let
    firstPowers = replicate firstDir standardPower
    standardPowers = replicate standardDir standardPower
    restPowers = replicate restDir restPower
    intervalPowers =
        join $
        replicate (intervalCount - 1)
        (restPowers <> standardPowers)
  in
    firstPowers <> intervalPowers
