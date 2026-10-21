# School Database Design

## Tables

### students
Stores one row for each student: an `id` (primary key), the student's `name` and their `email`. The email is `UNIQUE`, so two students cannot share one email address.

### courses
Stores one row for each course: an `id` (primary key), the course `title` and the number of `credits`.

### enrolments
Stores one row each time a student joins a course. It holds its own `id`, a `student_id` (foreign key to students), a `course_id` (foreign key to courses) and a `grade`. The grade can be empty until the student has been marked. A `UNIQUE (student_id, course_id)` rule stops the same student enrolling on the same course twice.

## Relationships

- **students to enrolments: one-to-many.** One student can have many enrolments, but each enrolment belongs to exactly one student.
- **courses to enrolments: one-to-many.** One course can have many enrolments, but each enrolment belongs to exactly one course.
- **students to courses: many-to-many.** One student can take many courses, and one course can have many students.

### Why a join table is needed
A single table cannot store a many-to-many relationship cleanly. We would have to repeat student details on every course row, or put several courses in one cell. The `enrolments` table solves this by linking the two tables, with one row for each student-and-course pair. It is also the natural place to store the grade, because a grade belongs to a student on a particular course, not to the student or the course alone.

## Index

I would add an index on `enrolments(course_id)`:

```sql
CREATE INDEX idx_enrolments_course_id ON enrolments(course_id);
```

**Reason:** Queries like "all students on one course" and "number of students per course" search enrolments by `course_id`. As the school grows to thousands of enrolments, the index lets the database find those rows quickly instead of reading the whole table. (Searches by `student_id` are already helped by the `UNIQUE (student_id, course_id)` rule.)

## SQL or NoSQL?

I would choose SQL for this system. School data is highly structured: every student has a name and email, every enrolment links one student to one course, and the relationships between them matter. SQL databases enforce these rules for us with foreign keys, NOT NULL and UNIQUE constraints, so we cannot enrol a student who does not exist or register the same email twice. Joins also make questions like "which students have no enrolments?" simple to answer. NoSQL could be useful if the data were unstructured or needed to scale across huge numbers of servers, but a school system needs accuracy and consistent relationships more than that.