#!/usr/bin/env bash
# This repo's EC2 AWS account only (CREDS/). Does not modify ~/.aws default profile.
#
#   source "$(git -C /path/to/REA-POS rev-parse --show-toplevel)/scripts/use-aws-ros.sh"
# or from repo root:
#   source scripts/use-aws-ros.sh

if [[ "${BASH_SOURCE[0]:-}" == "${0:-}" ]]; then
  echo "Source this file:  source scripts/use-aws-ros.sh" >&2
  exit 1
fi

# bash vs zsh when sourced
if [[ -n "${BASH_VERSION:-}" && -n "${BASH_SOURCE[0]:-}" ]]; then
  _script="${BASH_SOURCE[0]}"
elif [[ -n "${ZSH_VERSION:-}" ]]; then
  # shellcheck disable=SC2296
  _script="${(%):-%x}"
else
  _script="$0"
fi

[[ "$_script" != /* ]] && _script="${PWD}/${_script}"
_script_dir="$(cd "$(dirname "$_script")" && pwd)"
_root="$(cd "${_script_dir}/.." && pwd)"

if [[ ! -f "${_root}/CREDS/aws-credentials.ini" ]]; then
  echo "Missing ${_root}/CREDS/aws-credentials.ini — run from REA-POS scripts path." >&2
  return 1 2>/dev/null || exit 1
fi

export AWS_CONFIG_FILE="${_root}/CREDS/aws-config.ini"
export AWS_SHARED_CREDENTIALS_FILE="${_root}/CREDS/aws-credentials.ini"
export AWS_PROFILE=ros-ec2
export AWS_DEFAULT_PROFILE=ros-ec2
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN 2>/dev/null || true

echo "ROS AWS: profile=${AWS_PROFILE} region=eu-north-1 (keys in CREDS/, not ~/.aws)"