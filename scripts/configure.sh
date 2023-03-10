#!/bin/sh
mc alias set myminio $ACCESS_URL $ACCESS_KEY $SECRET_KEY

# Create a user console
mc admin user add myminio $CONSOLE_ACCESS_KEY $CONSOLE_SECRET_KEY

# Create a policy for console with admin access to all resources
mc admin policy add myminio consoleAdmin /scripts/admin.json

# Set the policy for the new console user
mc admin policy set myminio consoleAdmin user=console

mc mb --with-lock myminio/tenant1/x86_64
mc cp /samples/repo/tcping_0.3-1_x86_64.ipk myminio/tenant1/x86_64/tcping_0.3-1_x86_64.ipk