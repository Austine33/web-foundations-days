-- Turn on foreign key checking in SQLite
PRAGMA foreign_keys = ON;

-- Remove old tables so the file can be run again (enrolments first)
DROP TABLE IF EXISTS enrolments;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS students;

-- ===== TABLES =====

CREATE TABLE students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  credits INTEGER NOT NULL
);

CREATE TABLE enrolments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  grade TEXT,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  UNIQUE (student_id, course_id)
);

-- ===== DATA =====

INSERT INTO students (name, email) VALUES
  ('Amina Hassan', 'amina@example.com'),
  ('Brian Otieno', 'brian@example.com'),
  ('Grace Wanjiru', 'grace@example.com'),
  ('David Kamau', 'david@example.com');

INSERT INTO courses (title, credits) VALUES
  ('Web Foundations', 3),
  ('Databases', 4),
  ('JavaScript Basics', 3);

INSERT INTO enrolments (student_id, course_id, grade) VALUES
  (1, 1, 'A'),
  (1, 2, 'B'),
  (2, 1, 'B'),
  (2, 3, NULL),
  (3, 2, 'A'),
  (3, 3, 'C');

-- ===== QUERIES =====

-- Query 1: all courses for one student (by name)
SELECT courses.title, enrolments.grade
FROM students
JOIN enrolments ON enrolments.student_id = students.id
JOIN courses ON courses.id = enrolments.course_id
WHERE students.name = 'Amina Hassan';

-- Query 2: all students on one course
SELECT students.name, students.email
FROM courses
JOIN enrolments ON enrolments.course_id = courses.id
JOIN students ON students.id = enrolments.student_id
WHERE courses.title = 'Web Foundations';

-- Query 3: number of students per course
SELECT courses.title, COUNT(enrolments.id) AS number_of_students
FROM courses
LEFT JOIN enrolments ON enrolments.course_id = courses.id
GROUP BY courses.id, courses.title;

-- Query 4: students who have no enrolments
SELECT students.name, students.email
FROM students
LEFT JOIN enrolments ON enrolments.student_id = students.id
WHERE enrolments.id IS NULL;

-- Query 5: update one enrolment's grade (Brian, JavaScript Basics)
UPDATE enrolments
SET grade = 'B'
WHERE student_id = 2 AND course_id = 3;