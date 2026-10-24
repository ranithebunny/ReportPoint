-- ==========================================================
-- ReportPoint database schema (MySQL 8 / MariaDB 10.4+)
-- Import with phpMyAdmin: Import tab -> choose this file -> Go.
-- It creates the database `reportpoint`. Run seed.sql afterwards.
--
-- Design notes (for the project documentation):
--  * Lookup tables (statuses, priorities, tags, rejection_reasons)
--    keep the allowed values in ONE place and enforce them with foreign keys.
--  * report_history is APPEND-ONLY: the app only ever INSERTs into it,
--    so old entries are never overwritten when a status changes.
--  * Resident-visible comments and internal notes live in SEPARATE tables
--    so a bug in a resident-facing query can never leak an internal note.
--  * Passwords are stored only as hashes (password_hash() in PHP).
-- ==========================================================

CREATE DATABASE IF NOT EXISTS reportpoint
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE reportpoint;

-- ---------- Lookup tables ----------
CREATE TABLE statuses (
  status_id   TINYINT UNSIGNED PRIMARY KEY,
  name        VARCHAR(40) NOT NULL UNIQUE,
  sort_order  TINYINT UNSIGNED NOT NULL
) ENGINE=InnoDB;

CREATE TABLE priorities (
  priority_id TINYINT UNSIGNED PRIMARY KEY,
  name        VARCHAR(10) NOT NULL UNIQUE,
  sort_order  TINYINT UNSIGNED NOT NULL
) ENGINE=InnoDB;

CREATE TABLE categories (
  category_id TINYINT UNSIGNED PRIMARY KEY,
  name        VARCHAR(60) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE tags (
  tag_id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name   VARCHAR(40) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE rejection_reasons (
  reason_id TINYINT UNSIGNED PRIMARY KEY,
  name      VARCHAR(60) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- ---------- Accounts ----------
CREATE TABLE admins (
  admin_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(20)  NOT NULL UNIQUE,
  full_name     VARCHAR(80)  NOT NULL,
  email         VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- One row per permission an admin has: manage_reports | manage_residents | manage_admins
CREATE TABLE admin_permissions (
  admin_id   INT UNSIGNED NOT NULL,
  permission ENUM('manage_reports','manage_residents','manage_admins') NOT NULL,
  PRIMARY KEY (admin_id, permission),
  FOREIGN KEY (admin_id) REFERENCES admins(admin_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE residents (
  resident_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  resident_code    VARCHAR(12)  NOT NULL UNIQUE,          -- the username, e.g. CP-1208
  full_name        VARCHAR(80)  NOT NULL,
  unit             VARCHAR(10)  NOT NULL,
  email            VARCHAR(120) NULL,
  phone            VARCHAR(20)  NULL,
  password_hash    VARCHAR(255) NOT NULL,
  -- Shown to admins ONLY until the resident changes their password, then set to NULL.
  default_password VARCHAR(20)  NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 1,
  is_active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_by       INT UNSIGNED NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES admins(admin_id) ON DELETE SET NULL,
  INDEX idx_resident_name (full_name)
) ENGINE=InnoDB;

-- ---------- Reports ----------
CREATE TABLE reports (
  report_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_code    VARCHAR(14)  NOT NULL UNIQUE,            -- e.g. RP-2026-021 (shown to residents)
  resident_id    INT UNSIGNED NOT NULL,
  category_id    TINYINT UNSIGNED NOT NULL,
  title          VARCHAR(100) NOT NULL,
  location       VARCHAR(150) NOT NULL,
  description    TEXT         NOT NULL,
  observed_at    DATETIME     NULL,                       -- "Date and Time Observed" on the form
  priority_id    TINYINT UNSIGNED NOT NULL DEFAULT 1,
  status_id      TINYINT UNSIGNED NOT NULL DEFAULT 1,
  evidence_path  VARCHAR(255) NULL,
  rejection_reason_id   TINYINT UNSIGNED NULL,
  rejection_explanation VARCHAR(1000) NULL,               -- required when reason = Other
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (resident_id)         REFERENCES residents(resident_id),
  FOREIGN KEY (category_id)         REFERENCES categories(category_id),
  FOREIGN KEY (priority_id)         REFERENCES priorities(priority_id),
  FOREIGN KEY (status_id)           REFERENCES statuses(status_id),
  FOREIGN KEY (rejection_reason_id) REFERENCES rejection_reasons(reason_id),
  INDEX idx_reports_status (status_id),
  INDEX idx_reports_priority (priority_id),
  INDEX idx_reports_resident (resident_id),
  INDEX idx_reports_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE report_tags (
  report_id INT UNSIGNED NOT NULL,
  tag_id    TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (report_id, tag_id),
  FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)    REFERENCES tags(tag_id)
) ENGINE=InnoDB;

-- Resident-VISIBLE messages (admin comments, info requests, rejection notices, resident replies)
CREATE TABLE report_comments (
  comment_id  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id   INT UNSIGNED NOT NULL,
  author_type ENUM('admin','resident') NOT NULL,
  admin_id    INT UNSIGNED NULL,
  resident_id INT UNSIGNED NULL,
  kind        ENUM('comment','info_request','rejection','resident_reply') NOT NULL DEFAULT 'comment',
  body        VARCHAR(1000) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id)   REFERENCES reports(report_id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id)    REFERENCES admins(admin_id),
  FOREIGN KEY (resident_id) REFERENCES residents(resident_id),
  INDEX idx_comments_report (report_id, created_at)
) ENGINE=InnoDB;

-- INTERNAL notes: admins only. Never join this table in any resident-facing query.
CREATE TABLE report_notes (
  note_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id  INT UNSIGNED NOT NULL,
  admin_id   INT UNSIGNED NOT NULL,
  body       VARCHAR(1000) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id)  REFERENCES admins(admin_id),
  INDEX idx_notes_report (report_id, created_at)
) ENGINE=InnoDB;

-- Append-only activity log. Never UPDATE or DELETE rows here.
CREATE TABLE report_history (
  history_id  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id   INT UNSIGNED NOT NULL,
  event_type  ENUM('submitted','status_changed','priority_changed','tag_added','tag_removed',
                   'comment_added','note_added','info_requested','resident_response',
                   'rejected','resolved') NOT NULL,
  actor_type  ENUM('admin','resident','system') NOT NULL,
  admin_id    INT UNSIGNED NULL,
  resident_id INT UNSIGNED NULL,
  old_value   VARCHAR(100) NULL,
  new_value   VARCHAR(100) NULL,
  reason      VARCHAR(255) NULL,          -- rejection reason text
  info_needed VARCHAR(1000) NULL,         -- what we asked the resident for
  message     VARCHAR(1000) NULL,
  is_resident_visible TINYINT(1) NOT NULL DEFAULT 0,  -- 0 = admins only, 1 = shown on resident Track page
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id)   REFERENCES reports(report_id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id)    REFERENCES admins(admin_id),
  FOREIGN KEY (resident_id) REFERENCES residents(resident_id),
  INDEX idx_history_report (report_id, created_at)
) ENGINE=InnoDB;
