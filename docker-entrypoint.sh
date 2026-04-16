#!/bin/sh
set -e

CERTS_DIR="${DOCKLET_DATA_DIR:-/docklet-data}/certs"
CERT_FILE="$CERTS_DIR/cert.pem"
KEY_FILE="$CERTS_DIR/key.pem"

# Generate a self-signed certificate if none exists
if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
  mkdir -p "$CERTS_DIR"
  echo "Generating self-signed TLS certificate..."
  openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout "$KEY_FILE" \
    -out "$CERT_FILE" \
    -subj "/CN=docklet/O=Docklet" \
    2>/dev/null
  chmod 600 "$KEY_FILE"
  echo "Self-signed certificate generated."
fi

# Start nginx in the background
nginx -g 'daemon off;' &

# Start the Next.js application
exec node server.js
