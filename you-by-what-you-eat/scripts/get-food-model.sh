#!/usr/bin/env bash
# Lädt Googles Essens-Erkennungsmodell (AIY Food V1, Apache 2.0) für die Foto-KI.
# Das Modell liegt nicht im Repository (21 MB) und wird nach android/app/src/main/assets kopiert.
set -euo pipefail
cd "$(dirname "$0")/.."
tmp="$(mktemp -d)"
curl -sSL --http1.1 -o "$tmp/model.tar.gz" "https://www.kaggle.com/api/v1/models/google/aiy/tfLite/vision-classifier-food-v1/1/download"
tar -xzf "$tmp/model.tar.gz" -C "$tmp"
mkdir -p android/app/src/main/assets
cp "$tmp/1.tflite" android/app/src/main/assets/food_v1.tflite
echo "Modell gespeichert: android/app/src/main/assets/food_v1.tflite"
