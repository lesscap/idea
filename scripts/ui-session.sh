#!/usr/bin/env bash
# Drives sign-in state in the browser agent-browser is attached to.
#
# Exists because doing this by hand kept going wrong: refs from `snapshot` are
# renumbered on every call, several controls read as similar text ("默认空间" is
# the workspace switcher, "平台管理员" is the account menu), and the session
# cookie is httpOnly so it cannot be cleared from the page. Guessing a ref and
# clicking the wrong control was the normal outcome.
#
# Everything here targets data-testid attributes, which do not move between
# renders or translations.
#
#   scripts/ui-session.sh signout
#   scripts/ui-session.sh signin admin01 dev-password-01
#   scripts/ui-session.sh as wang.li another-password    # signout, then signin
#
set -euo pipefail

WEB=${IDEA_WEB:-http://localhost:5300}

signout() {
  # Through the API, not the UI: the cookie is httpOnly, and reaching the
  # sign-out item means opening a menu whose ref changes every render.
  agent-browser open "$WEB/" >/dev/null 2>&1 || true
  agent-browser eval "fetch('/api/web/session', { method: 'DELETE' }).then(r => r.status)" >/dev/null 2>&1 || true
  sleep 1
}

signin() {
  local user=$1 pass=$2
  agent-browser open "$WEB/login" >/dev/null
  agent-browser wait '[data-testid=login-username]' >/dev/null
  agent-browser fill '[data-testid=login-username]' "$user" >/dev/null
  agent-browser fill '[data-testid=login-password]' "$pass" >/dev/null
  agent-browser click '[data-testid=login-submit]' >/dev/null
  # Waiting on the control that only exists once signed in beats a fixed sleep,
  # which is the other way this kept failing.
  agent-browser wait '[data-testid=user-menu]' >/dev/null
  echo "signed in as $user at $(agent-browser eval 'location.pathname' 2>/dev/null | tr -d '"')"
}

case ${1:-} in
  signout) signout; echo "signed out" ;;
  signin)  signin "${2:?username}" "${3:?password}" ;;
  as)      signout; signin "${2:?username}" "${3:?password}" ;;
  *)       echo "usage: $0 {signout|signin <user> <pass>|as <user> <pass>}" >&2; exit 1 ;;
esac
