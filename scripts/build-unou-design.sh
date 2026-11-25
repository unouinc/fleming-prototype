#!/usr/bin/env bash
# unou.design/nasuri/ に置くファイル一式を out/ に作る（病院向けサイトと、そこから参照するファイルだけ）
set -euo pipefail
rm -rf out && mkdir -p out/hospital out/images
sed -e 's#\.\./\.\./job\.html#https://unouinc.github.io/fleming-prototype/job.html#g' \
    -e 's#\.\./\.\./#../#g' site/nasuri/hospital/index.html > out/hospital/index.html
cp site/config.js out/
for f in $(grep -o '\.\./\.\./images/[A-Za-z0-9._-]*' site/nasuri/hospital/index.html | sort -u | sed 's#.*/##'); do
  cp "site/images/$f" out/images/
done
for f in terms privacy; do
  sed 's#href="index.html"#href="hospital/"#g' "site/$f.html" > "out/$f.html"
done
if grep -q '\.\./\.\./' out/hospital/index.html; then echo "書き換え漏れがあります"; exit 1; fi
