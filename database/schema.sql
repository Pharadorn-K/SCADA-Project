-- database/schema.sql
-- Run with:
--   mysql -h 10.207.1.87 -P 3306 -u PCSET123 -p scada -e "SOURCE database/schema.sql"
-- Or from MySQL Workbench:
--   SOURCE database/schema.sql

USE scada;

-- ─────────────────────────────────────────────────────────────────────────────
--  Legacy / raw PLC tables (kept for reference — not actively used by Node)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plc_readings (
    id        BIGINT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    timestamp TIMESTAMP(2),
    bits      INT,
    words     INT,
    raw_data  JSON
);

-- ─────────────────────────────────────────────────────────────────────────────
--  Raw PLC event tables (written by Python plc_loop.py → db_writer.py)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS raw_press (
    id_row       BIGINT AUTO_INCREMENT PRIMARY KEY,
    event        VARCHAR(64)    NOT NULL DEFAULT '',
    source       VARCHAR(64)    NOT NULL DEFAULT '',
    department   VARCHAR(64)    NOT NULL DEFAULT '',
    machine      VARCHAR(64)    NOT NULL DEFAULT '',
    machine_type VARCHAR(64)    NOT NULL DEFAULT '',
    timestamp    DATETIME(3)    NOT NULL,
    part_name    VARCHAR(128)   NOT NULL DEFAULT '',
    plan         INT            NOT NULL DEFAULT 0,
    operator_id  VARCHAR(64)    NOT NULL DEFAULT '',
    count_signal TINYINT        NOT NULL DEFAULT 0,
    run          TINYINT        NOT NULL DEFAULT 0,
    idle         TINYINT        NOT NULL DEFAULT 0,
    alarm        TINYINT        NOT NULL DEFAULT 0,
    offline      TINYINT        NOT NULL DEFAULT 0,
    alarm_code   INT            NOT NULL DEFAULT 0,
    cycle_time   FLOAT          NOT NULL DEFAULT 0,
    count_shift  INT            NOT NULL DEFAULT 0,
    created_at   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_press_machine   (machine),
    INDEX idx_press_timestamp (timestamp),
    INDEX idx_press_machine_ts (machine, timestamp)
);

CREATE TABLE IF NOT EXISTS raw_heat (
    id_row       BIGINT AUTO_INCREMENT PRIMARY KEY,
    event        VARCHAR(64)    NOT NULL DEFAULT '',
    source       VARCHAR(64)    NOT NULL DEFAULT '',
    department   VARCHAR(64)    NOT NULL DEFAULT '',
    machine      VARCHAR(64)    NOT NULL DEFAULT '',
    machine_type VARCHAR(64)    NOT NULL DEFAULT '',
    timestamp    DATETIME(3)    NOT NULL,
    part_name    VARCHAR(128)   NOT NULL DEFAULT '',
    plan         INT            NOT NULL DEFAULT 0,
    operator_id  VARCHAR(64)    NOT NULL DEFAULT '',
    run          TINYINT        NOT NULL DEFAULT 0,
    heat         TINYINT        NOT NULL DEFAULT 0,
    count_signal TINYINT        NOT NULL DEFAULT 0,
    idle         TINYINT        NOT NULL DEFAULT 0,
    setting      TINYINT        NOT NULL DEFAULT 0,
    alarm        TINYINT        NOT NULL DEFAULT 0,
    offline      TINYINT        NOT NULL DEFAULT 0,
    alarm_code   INT            NOT NULL DEFAULT 0,
    cycle_time   FLOAT          NOT NULL DEFAULT 0,
    count_shift  INT            NOT NULL DEFAULT 0,
    created_at   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_heat_machine    (machine),
    INDEX idx_heat_timestamp  (timestamp),
    INDEX idx_heat_machine_ts (machine, timestamp)
);

CREATE TABLE IF NOT EXISTS raw_lathe (
    id_row       BIGINT AUTO_INCREMENT PRIMARY KEY,
    event        VARCHAR(64)    NOT NULL DEFAULT '',
    source       VARCHAR(64)    NOT NULL DEFAULT '',
    department   VARCHAR(64)    NOT NULL DEFAULT '',
    machine      VARCHAR(64)    NOT NULL DEFAULT '',
    machine_type VARCHAR(64)    NOT NULL DEFAULT '',
    timestamp    DATETIME(3)    NOT NULL,
    part_name    VARCHAR(128)   NOT NULL DEFAULT '',
    plan         INT            NOT NULL DEFAULT 0,
    operator_id  VARCHAR(64)    NOT NULL DEFAULT '',
    count_signal TINYINT        NOT NULL DEFAULT 0,
    run          TINYINT        NOT NULL DEFAULT 0,
    idle         TINYINT        NOT NULL DEFAULT 0,
    alarm        TINYINT        NOT NULL DEFAULT 0,
    offline      TINYINT        NOT NULL DEFAULT 0,
    alarm_code   INT            NOT NULL DEFAULT 0,
    cycle_time   FLOAT          NOT NULL DEFAULT 0,
    count_shift  INT            NOT NULL DEFAULT 0,
    max_value    FLOAT          NOT NULL DEFAULT 0,
    min_value    FLOAT          NOT NULL DEFAULT 0,
    max_min      FLOAT          NOT NULL DEFAULT 0,
    limit_value  FLOAT          NOT NULL DEFAULT 0,
    mc_time      FLOAT          NOT NULL DEFAULT 0,
    created_at   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_lathe_machine    (machine),
    INDEX idx_lathe_timestamp  (timestamp),
    INDEX idx_lathe_machine_ts (machine, timestamp)
);

-- ─────────────────────────────────────────────────────────────────────────────
--  Shift summary tables (written by Node persistenceEngine / shiftEngine)
-- ─────────────────────────────────────────────────────────────────────────────

-- Per-shift totals (one row per machine per shift)
CREATE TABLE IF NOT EXISTS machine_shift_summary (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    date            DATE           NOT NULL,
    shift           CHAR(1)        NOT NULL,          -- 'A' | 'B' | 'C'
    department      VARCHAR(64)    NOT NULL,
    machine         VARCHAR(64)    NOT NULL,
    run_seconds     INT            NOT NULL DEFAULT 0,
    idle_seconds    INT            NOT NULL DEFAULT 0,
    alarm_seconds   INT            NOT NULL DEFAULT 0,
    offline_seconds INT            NOT NULL DEFAULT 0,
    availability    FLOAT          NULL,
    count_output    INT            NOT NULL DEFAULT 0,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_shift_summary (date, shift, department, machine),
    INDEX idx_summary_date       (date),
    INDEX idx_summary_dept_mc    (department, machine)
);

-- Per-hour rows (written by hourlyAggregator.js every 60 s)
CREATE TABLE IF NOT EXISTS machine_shift_status (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    date            DATE           NOT NULL,
    shift           CHAR(1)        NOT NULL,
    hour_bucket     DATETIME       NOT NULL,           -- e.g. 2026-04-25 09:00:00
    department      VARCHAR(64)    NOT NULL,
    machine         VARCHAR(64)    NOT NULL,
    run_seconds     INT            NOT NULL DEFAULT 0,
    idle_seconds    INT            NOT NULL DEFAULT 0,
    alarm_seconds   INT            NOT NULL DEFAULT 0,
    offline_seconds INT            NOT NULL DEFAULT 0,
    availability    FLOAT          NULL,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_shift_status (date, shift, hour_bucket, department, machine),
    INDEX idx_status_hour_bucket (hour_bucket),
    INDEX idx_status_dept_mc     (department, machine)
);

-- ─────────────────────────────────────────────────────────────────────────────
--  Source / location config table (read by Python clean_data.py)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS source_plc_location (
    id_row       INT AUTO_INCREMENT PRIMARY KEY,
    type_        VARCHAR(64)    NOT NULL DEFAULT '',
    department_  VARCHAR(64)    NOT NULL DEFAULT '',
    machine_     VARCHAR(64)    NOT NULL DEFAULT '',
    target_      VARCHAR(64)    NOT NULL DEFAULT '',
    range_       INT            NOT NULL DEFAULT 0,
    note_        VARCHAR(64)    NOT NULL DEFAULT '',
    category_    VARCHAR(64)    NOT NULL DEFAULT '',
    INDEX idx_location_dept (department_),
    INDEX idx_location_note (note_)
);

-- ─────────────────────────────────────────────────────────────────────────────
--  User accounts  (used by backend/node/routes/api/auth.js)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scada_users (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    username             VARCHAR(64)    NOT NULL UNIQUE,
    display_name         VARCHAR(128)   NOT NULL DEFAULT '',
    password_hash        VARCHAR(255)   NOT NULL,
    role                 ENUM('operator','supervisor','admin')
                                        NOT NULL DEFAULT 'operator',
    active               TINYINT(1)     NOT NULL DEFAULT 1,
    must_change_password TINYINT(1)     NOT NULL DEFAULT 0,
    created_at           TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_role (role)
);

-- ─────────────────────────────────────────────────────────────────────────────
--  Alarm / audit log  (used by backend/node/services/logService.js)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scada_alarm_log (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    ts         DATETIME(3)    NOT NULL,
    event      ENUM('RAISED','CLEARED','ACK')
                              NOT NULL,
    code       VARCHAR(128)   NOT NULL DEFAULT '',
    message    TEXT           NOT NULL,
    severity   VARCHAR(32)    NOT NULL DEFAULT 'INFO',
    ack_by     VARCHAR(128)   NULL,
    user_      VARCHAR(128)   NOT NULL DEFAULT 'system',
    role_      VARCHAR(128)   NOT NULL DEFAULT 'system',
    created_at TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_alarm_ts    (ts),
    INDEX idx_alarm_event (event),
    INDEX idx_alarm_code  (code)
);