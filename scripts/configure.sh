#!/bin/bash
mc alias set myminio $ACCESS_URL $ACCESS_KEY $SECRET_KEY

# Create a user console
mc admin user add myminio $CONSOLE_ACCESS_KEY $CONSOLE_SECRET_KEY

# Create a policy for console with admin access to all resources
mc admin policy add myminio consoleAdmin /scripts/admin.json

# Set the policy for the new console user
mc admin policy set myminio consoleAdmin user=console

mc mb --with-lock myminio/tenant1

# Make bucket public to host/access static content.
mc anonymous set download myminio/tenant1

for f in    automount_1-40_x86_64.ipk \
            libgcc_8.4.0-11_armv7-3.2.ipk \
            tcping_0.3-1_x86_64.ipk \
            ffmpeg_5.1.2-1_armv7-3.2.ipk \
            python-flup_1.0.1-ml0.3-py2.7_armv7a.ipk \
            grep_3.8-2_armv7-3.2.ipk \
            tcping_0.3-1_arm_cortex-a7_neon-vfpv4.ipk \
; do
    echo "F: ${f}"
    mc cp "/samples/repo/${f}" "myminio/tenant1/x86_64/${f}";
done