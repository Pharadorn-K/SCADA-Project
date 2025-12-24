-- database/schema.sql
-- bash psql -U user -d scada -f database/schema.sql
-- CREATE DATABASE IF NOT EXISTS scada;
USE scada;

-- CREATE TABLE IF NOT EXISTS plc_reads (
--     id BIGINT AUTO_INCREMENT PRIMARY KEY NOT NULL,
--     timestamp TIMESTAMP(2) DEFAULT CURRENT_TIMESTAMP(2),
--     tag_name VARCHAR(64) NOT NULL,
--     value_type ENUM('bit', 'word') NOT NULL,
--     int_value INT,
--     raw_json JSON,
--     INDEX idx_timestamp (timestamp),
--     INDEX idx_tag (tag_name)
-- );
CREATE TABLE plc_readings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    timestamp TIMESTAMP(2),
    bits INT,
    words INT,
    raw_data JSON
);

