#!/bin/bash
set -euo pipefail
project_root="$(cd "$(dirname "$0")/.." && pwd)"
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "请在安装完整 Xcode 的 Mac 上运行。" >&2
  exit 1
fi
if xcrun --find safari-web-extension-packager >/dev/null 2>&1; then
  packager="safari-web-extension-packager"
elif xcrun --find safari-web-extension-converter >/dev/null 2>&1; then
  packager="safari-web-extension-converter"
else
  echo "找不到 Safari 扩展打包工具。请安装完整 Xcode，并在 Xcode > Settings > Locations 选择 Command Line Tools。" >&2
  exit 1
fi
if [[ -e "$project_root/safari-project" ]]; then
  echo "safari-project 已存在，请直接打开现有工程；本脚本不会覆盖。" >&2
  exit 1
fi
xcrun "$packager" "$project_root/extension" \
  --project-location "$project_root/safari-project" \
  --app-name "Night" --bundle-identifier "dev.xinzhe.night" \
  --macos-only --swift
