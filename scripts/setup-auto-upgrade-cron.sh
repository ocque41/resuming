#!/bin/bash

# Script to set up a cron job for automatically upgrading all users to Pro plan
# Usage: ./setup-auto-upgrade-cron.sh [BASE_URL] [API_KEY]

BASE_URL=${1:-"http://localhost:3000"}
API_KEY=${2:-"your-api-key-here"}

# Check if crontab is available
if ! command -v crontab &> /dev/null; then
    echo "Error: crontab is not installed. Please install it first."
    exit 1
fi

# Create the cron job command
CRON_CMD="0 0 * * * curl -X GET -H \"x-api-key: $API_KEY\" $BASE_URL/api/admin/upgrade-all-users > /tmp/auto-upgrade-log.txt 2>&1"

# Add to crontab if not already present
if ! (crontab -l 2>/dev/null | grep -q "upgrade-all-users"); then
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
    echo "Cron job has been added to run daily at midnight."
    echo "It will call: $BASE_URL/api/admin/upgrade-all-users"
else
    echo "Cron job is already set up."
fi

echo -e "\nYou can manually trigger the upgrade by calling:"
echo "curl -X GET -H \"x-api-key: $API_KEY\" $BASE_URL/api/admin/upgrade-all-users"
echo -e "\nMake sure to set ADMIN_API_KEY in your environment variables to \"$API_KEY\"." 