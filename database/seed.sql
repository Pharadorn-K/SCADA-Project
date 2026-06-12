-- database/seed.sql
-- Default admin account
-- Password: Admin@1234  (bcrypt hash — change immediately after first login)
-- Generate a new hash with:  node backend/node/generate-hash.js

INSERT INTO scada_users
    (username, display_name, password_hash, role, active, must_change_password)
VALUES (
    'admin',
    'Administrator',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'admin',
    1,
    1   -- force password change on first login
)
ON DUPLICATE KEY UPDATE username = username;