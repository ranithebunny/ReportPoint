-- ==========================================================
-- ReportPoint seed data. Run AFTER schema.sql.
-- Fills the lookup tables and creates ONE starter admin:
--     username: admin     password: admin123
-- CHANGE THAT PASSWORD after your first login (and never use it on a live site).
-- ==========================================================
USE reportpoint;

INSERT INTO statuses (status_id, name, sort_order) VALUES
  (1, 'Received', 1), (2, 'Under Review', 2), (3, 'In Progress', 3),
  (4, 'Awaiting Resident Response', 4), (5, 'Resolved', 5), (6, 'Closed', 6), (7, 'Rejected', 7);

INSERT INTO priorities (priority_id, name, sort_order) VALUES (1, 'Low', 1), (2, 'Medium', 2), (3, 'High', 3);

INSERT INTO categories (category_id, name) VALUES
  (1, 'Building/Structural'), (2, 'Utilities/Maintenance'), (3, 'Sanitation/Environment'), (4, 'Safety, Peace & Order');

INSERT INTO tags (name) VALUES
  ('Urgent'), ('Needs Inspection'), ('Requires More Information'),
  ('Duplicate Report'), ('Forwarded to Department'), ('Follow-up Required');

INSERT INTO rejection_reasons (reason_id, name) VALUES
  (1, 'Duplicate Report'), (2, 'Insufficient Information'), (3, 'Invalid Location'),
  (4, 'Outside Service Area or Jurisdiction'), (5, 'Not Covered by the Reporting System'),
  (6, 'Invalid Submission'), (7, 'Other');

-- Starter admin (password_hash of "admin123")
INSERT INTO admins (username, full_name, email, password_hash) VALUES
  ('admin', 'Rania San Pedro', 'rania.sanpedro@gmail.com', '$2y$10$3/ZNv13WNzVxFRUtEQFVZeU4YcoJt2omFrMqNp0o.hVVEO.UYNa4q');
INSERT INTO admin_permissions (admin_id, permission)
  SELECT admin_id, p FROM admins, (SELECT 'manage_reports' AS p UNION SELECT 'manage_residents' UNION SELECT 'manage_admins') perms
  WHERE username = 'admin';
