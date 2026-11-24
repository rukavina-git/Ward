#!/bin/bash
# PostToolUse hook for Edit/Write. After a code or config file in this repo
# changes, runs the typecheck and lints that file. Problems go back to
# Claude as a "block" decision, so it fixes them before moving on.

file=$(jq -r '.tool_input.file_path // empty')
repo="${CLAUDE_PROJECT_DIR:-$PWD}"

[[ $file == "$repo"/* ]] || exit 0
case "$file" in
  */node_modules/* | */dist/*) exit 0 ;;
  *.ts | *.js | *.mjs | *.cjs | *.json) ;;
  *) exit 0 ;;
esac

cd "$repo" || exit 0
[ -d node_modules ] || exit 0

out=""
if ! tc=$(npm run -s typecheck 2>&1); then
  out+="npm run typecheck failed:"$'\n'"$tc"$'\n'
fi
if [[ $file != *.json ]] && ! li=$(npx --no-install eslint --no-warn-ignored "$file" 2>&1); then
  out+="eslint failed on $file:"$'\n'"$li"$'\n'
fi

[ -z "$out" ] && exit 0
jq -n --arg r "$(head -c 4000 <<<"$out")" '{decision: "block", reason: $r}'
exit 0
