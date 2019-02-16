module Main where

import           Lib

main :: IO ()
main = do
  putStr $ unlines $ show <$> workoutToBals 244.2 21000 14 140 (60, 340) (90, 120)
  print $ xWPrime 244.2 21000 14 140 (60, 340) (90, 120)
