#!/bin/sh
# Runs once, on first start of an empty data volume. One database per service, each owned
# by its own login role, and no role can connect to another service's database
# (NFR-SL-02: ownership enforced by permissions).
set -eu

create() {
  name="$1"
  password="$2"
  psql -v ON_ERROR_STOP=1 --username postgres <<SQL
CREATE ROLE ${name} LOGIN PASSWORD '${password}';
CREATE DATABASE ${name} OWNER ${name} ENCODING 'UTF8' TEMPLATE template0;
REVOKE ALL ON DATABASE ${name} FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE ${name} TO ${name};
SQL
}

create identity "${IDENTITY_DB_PASSWORD}"
create competition "${COMPETITION_DB_PASSWORD}"
create payment "${PAYMENT_DB_PASSWORD}"
create notification "${NOTIFICATION_DB_PASSWORD}"

# pg_trgm powers typo-tolerant search in the competition database (A-19).
psql -v ON_ERROR_STOP=1 --username postgres --dbname competition -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm;'
