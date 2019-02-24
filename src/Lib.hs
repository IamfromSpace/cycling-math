{-# LANGUAGE NamedFieldPuns #-}
module Lib
    ( totalConsumed
    , wPrimeBals
    , xWPrime
    , workoutToPowers
    , powersToBals
    , Workout(..)
    ) where

import           Control.Monad (join)

type Fitness = (Float, Float)

nextBal :: Fitness -> Float -> Float -> Float
nextBal (cp, wPrime) bal p =
  bal + (cp - p) * (if p > cp then 1 else (wPrime - bal) / wPrime)

wPrimeBals :: Fitness -> Float -> [Float] -> [Float]
wPrimeBals fitness balInit =
  reverse . foldl (\bals p -> nextBal fitness (head bals) p : bals) [balInit]

totalConsumed :: [Float] -> Float
totalConsumed (h:t) =
  fst $ foldl (\(runningTotal, previousBal) bal -> (runningTotal + max 0.0 (previousBal - bal), bal)) (0, h) t

xWPrime :: Fitness -> [Float] -> Float
xWPrime fitness@(_, wPrime) =
  (/ wPrime) .
    totalConsumed .
    powersToBals fitness

powersToBals :: Fitness -> [Float] -> [Float]
powersToBals fitness@(_, wPrime) = wPrimeBals fitness wPrime

data Workout = Workout
  { intervalCount    :: Int
  , firstDuration    :: Int
  , standardDuration :: Int
  , standardPower    :: Float
  , restDuration     :: Int
  , restPower        :: Float
  }

workoutToPowers :: Workout -> [Float]
workoutToPowers Workout { intervalCount, firstDuration, standardDuration, standardPower, restDuration, restPower } =
  let
    firstPowers = replicate firstDuration standardPower
    standardPowers = replicate standardDuration standardPower
    restPowers = replicate restDuration restPower
    intervalPowers =
        join $
        replicate (intervalCount - 1)
        (restPowers <> standardPowers)
  in
    firstPowers <> intervalPowers
