# Final Project Milestones Document — Learnix

**Table of content**

# **WEEK 1 — Authentication, Authorization, Layout & Dashboard Foundation**

## **Goal:**

Build the core technical foundation of Learnix, including authentication, authorization, design system, and dashboard prototype.

## **Tasks**

### **Core / System Setup**

- **Repository & architecture setup** **_(~2-3 hours)_**
  - Create FE/BE repos, folder structure, environment configs.

    > **Team member:** Core/All

- **Database design** **_(~5-6 hours)_**
  - Main entities: `users`, `courses`, `lessons`, `enrollments`,
    `quizzes`, `questions`, `progress`, `submissions`, `reviews`.
  - Define relationships and constraints (1-N, N-N).

    > **Team member:** Backend

### Common Auth

- **Authentication _(3–4 hours)_**

  **Email/Password Auth**
  - Sign Up page + API
  - Sign In page + API
  - Token/session handling

    > **Team member:** Full-stack dev

    **Google OAuth**

  - Configure Google OAuth client
  - Implement Google login flow
  - Map Google account → Learnix user

    > **Team member:** Frontend + Backend

- **Authorization (Role-based) _(2–3 hours)_**
  - Create roles: guest, student, instructor, admin.
  - Implement route guards & protected routes.
  - Hide/show/ Restricted UI elements depending on permissions.

    > **Team member:** Frontend dev

- **Layout & Theme System _(2–3 hours)_**
  - Create AppShell (header, sidebar, content area).
  - Build global theme (colors, typography, spacing).
  - Create reusable components (Button, Card, FormField).

    > **Team member:** Frontend dev

- **Dashboard Prototype _(2–3 hours)_**
  - Create dashboard layout.
  - Add 3 widgets with mock data:
    - Summary Cards
    - Progress overview
    - Activity list
  - Role-based dashboard display.

    > **Team member:** Frontend dev

## **Total time:** _16\**–*\*22 hours_

---

# **WEEK 2 — Guest Browsing + Student Learning MVP**

## **Goal:**

**Week goal:** complete the main learning entry flow: browse → search → enroll → view lessons.

## **Tasks**

### **Guest + Public Features**

- **Homepage (Public) _(2–3 hours)_**
  - Display latest courses.
  - Display categories and trending tags.

    > **Team member:** Frontend dev

- **Course List Page _(2–3 hours)_**
  - Filter by category or tag.
  - Display course cards (title, instructor, difficulty).
  - Display whether pagination or infinite scroll.

    > **Team member:** Frontend + Backend

- **Course Detail Page _(2–3 hours)_**
  - Show course overview, tags, instructor info, student count.
  - Lock lessons/quizzes for guest users (Display a pop up requesting for subcribing account)

    > **Team member:** Frontend + Backend

- **Search System _(0.5–1 hours)_**
  - Implement full-text search across title, summary, and tags.

    > **Team member:** Frontend + Backend

- **Public Navigation _(1 hours)_**
  - Navbar (Home, Courses, Login/Signup).

    > **Team member:** Frontend

### Student Features

- **Enroll / Unenroll Flow _(3–4 hours)_**
  - Allow to enroll courses based on the student’s budget.
    - Unenroll from “My Courses”.

    > **Team member:** Frontend + Backend

- **Lesson Viewer (text + video)** **_(7–8 hours)_**
  - Show lesson list after enrollment.
  - Render text lessons (paper material/pdf slides) + embedded video lessons.

    > **Team member:** Frontend + Backend

- **Student Dashboard _(6–12 hours)_**
  - List enrolled courses.
  - Course status: in-progress / completed.
  - Completion % = completed lessons / total lessons.
  - Suggested courses base on previous courses and interests (if applicable).

    > **Team member:** Frontend + Backend

## Total time: _~26-35 hours_

---

# **WEEK 3 — Instructor + Manual Quiz**

## **Goal:**

Allow instructors to create courses/lessons/quizzes; students can take quizzes and get instant scoring.

## **Tasks**

### Instructor Features

- **Course Management _(5-6 hours)_**
  - Create course: title, summary, tags, category, level, thumbnail.
  - Edit/update/delete course.
  - Publish / unpublish (draft vs published).
    > **Team member:** Frontend + Backend
- **Lesson Management _(6 - 8 hours)_**
  - Add / edit lessons with text.
  - Attach video link/file.
    > **Team member:** Frontend + Backend
- **Instructor Dashboard _(4–5 hours)_**
  - Show created courses.
  - Show student enrollment + average quiz score.

### Quiz Features (Manual)

- **Instructor creates quizzes manually _(~7–8 hours)_**
  - Create quiz per course or lesson.
  - Add MCQ questions (A/B/C/D + correct answer).
    > **Team member:** Frontend + Backend
- **Student takes quiz + instant scoring** **_(~6–7 hours)_**
  - Submit answers → auto-grade.
  - Save submission + score.
    > **Team member:** Frontend + Backend

## Total time: ~\*31**–34 hours\***

---

# **WEEK 4 — Admin Module + AI Quiz Generator MVP**

## Goal

Build admin control and “highlight features”: AI-generated quizzes, and track learning progress.

## Tasks

### **Admin Features**

- **User Management _(6–8 hours)_**
  - View all users.
  - Assign roles.
  - Lock/unlock accounts.
    > **Team member:** Frontend + Backend
- **Course Moderation _(5–6 hours)_**
  - States: draft → pending → approved/published → rejected/hidden.
    > **Team member:** Frontend + Backend
- **System Statistics _(3–4 hours)_**
  - Total users, courses, enrollments.
    > **Team member:** Frontend + Backend

### **Instructor Feature: AI Quiz Generator (MVP)**

- **Generate MCQ from lesson text** **_(~8–10 hours)_**
  - Input: lesson text / course summary.
  - Output: 5–10 draft MCQs.
    > **Team member:** Backend
- **Instructor review & edit before saving** **_(~5–6 hours)_**
  - Preview AI questions.
  - Edit answers, remove bad items.
  - Approve → quiz saved.
    > **Team member:** Frontend + Backend

## **Total time:** ~_30\**–*\*34 hours_

---

# **WEEK 5 — Embedded IDE + Testing + Final Release**

## Goal

Build in-browser coding, polish UI/UX, full system testing, deployment, and final presentation.

## **Tasks**

### Student Feature: Embedded IDE (Optional)

- **IDE UI integration** _(~5–6 hours)_
  - Code editor, Run button, Output console.
  - Attach IDE to lesson or separate practice page.
    > **Team member:** Frontend
- **Multi-language runtime (≥2 languages)** _(~6–8 hours, Backend)_
  - Suggested languages: **Python + JavaScript**.
    > **Team member:** Backend

### **Final Polish & QA**

- **UI/UX refinement** _(~6–8 hours, Frontend)_
  - Responsive screens, loading/empty states, error messages.
    > **Team member:** Frontend
- **Testing + bug fixing** _(~10–12 hours, QA + All)_
  - Test core flows:
    - Auth + OTP
    - Guest browse/search
    - Student enroll → lessons → quiz → IDE
    - Instructor create course/lesson/quiz/AI quiz
    - Admin approve/reject/role control
      > **Team member:** QA + All
- **Deployment + demo preparation** _(~6–8 hours, All)_
  - Deploy FE/BE.
  - Seed demo data.
  - Final report + slides + demo script/video.
    > **Team member:** All

## **Total Time:** ~35 hours
