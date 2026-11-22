#!/usr/bin/env bash
# Lädt die zwei Erkennungsmodelle der Foto-KI (beide Apache 2.0, Google) nach android/app/src/main/assets:
#   food_v1.tflite  – AIY Food V1: ≈ 2.000 Gerichte/Speisen (21 MB)
#   inet_v3s.tflite – MobileNetV3-small (ImageNet): Obst, Gemüse, Alltagsdinge (10 MB)
# Die Modelle liegen nicht im Repository.
set -euo pipefail
cd "$(dirname "$0")/.."
tmp="$(mktemp -d)"
mkdir -p android/app/src/main/assets "$tmp/food" "$tmp/inet"

curl -sSL --http1.1 -o "$tmp/food.tar.gz" "https://www.kaggle.com/api/v1/models/google/aiy/tfLite/vision-classifier-food-v1/1/download"
tar -xzf "$tmp/food.tar.gz" -C "$tmp/food"
cp "$tmp/food/1.tflite" android/app/src/main/assets/food_v1.tflite

curl -sSL --http1.1 -o "$tmp/inet.tar.gz" "https://www.kaggle.com/api/v1/models/google/mobilenet-v3/tfLite/small-100-224-classification-metadata/1/download"
tar -xzf "$tmp/inet.tar.gz" -C "$tmp/inet"
cp "$(ls "$tmp"/inet/*.tflite | head -1)" android/app/src/main/assets/inet_v3s.tflite

echo "Modelle gespeichert in android/app/src/main/assets (food_v1.tflite, inet_v3s.tflite)"
