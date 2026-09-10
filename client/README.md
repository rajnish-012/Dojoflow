# DojoFlow 🥋

DojoFlow is a full-stack Karate Academy Management System designed to manage students, training plans, curriculum, attendance, performance evaluations, progress tracking, and role-based access.

The application provides separate experiences for academy administrators, branch administrators, coaches, and students.

---

## 🚀 Features

### Authentication & Authorization

- User registration and login
- JWT-based authentication
- Password hashing using bcrypt
- Role-based access control
- Protected backend APIs
- Protected frontend routes
- Persistent login using localStorage
- Logout functionality

### User Roles

DojoFlow supports four roles:

- `SUPER_ADMIN`
- `BRANCH_ADMIN`
- `COACH`
- `STUDENT`

### Student Management

- Student admission
- Student profile management
- Student age and contact details
- Branch assignment
- Training plan assignment
- Join date
- Current belt
- Student status
- Student login account creation
- Student account linked to student profile

### Training Plans

- Create training plans
- Edit training plans
- Delete training plans
- Plan duration
- Plan price
- Classes per week
- Starting belt
- Milestones
- Day-wise curriculum

### Curriculum

- Day-wise training curriculum
- Training topics
- Plan-based curriculum
- Milestone tracking
- Belt progression structure

### Attendance

- Mark student attendance
- Attendance by training date
- Curriculum/training session information
- Branch-based attendance access
- Attendance history

### Performance

- Student performance evaluation
- Training day
- Curriculum selection
- Star-based performance rating
- Coach remarks
- Evaluation date
- Performance history

### Progress

- Student training progress
- Completed training days
- Current training day
- Plan-based progress tracking
- Progress percentage

### Student Portal

Students have a dedicated portal where they can view:

- Personal profile
- Current belt
- Training plan
- Branch
- Join date
- Contact information
- Plan price
- Student status
- Training progress
- Attendance
- Performance

Students can only access their own information.

---

# 🛠️ Tech Stack

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- Lucide React
- Next.js App Router

## Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT
- bcryptjs

---

# 📁 Project Structure

```text
DojoFlow/
│
├── client/
│   ├── app/
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   │
│   │   ├── students/
│   │   │   └── page.tsx
│   │   │
│   │   ├── plans/
│   │   │   └── page.tsx
│   │   │
│   │   ├── curriculum/
│   │   │   └── page.tsx
│   │   │
│   │   ├── attendance/
│   │   │   └── page.tsx
│   │   │
│   │   ├── performance/
│   │   │   └── page.tsx
│   │   │
│   │   ├── student-dashboard/
│   │   │   └── page.tsx
│   │   │
│   │   ├── settings/
│   │   │   └── staff/
│   │   │       └── page.tsx
│   │   │
│   │   ├── login/
│   │   │   └── page.tsx
│   │   │
│   │   └── layout.tsx
│   │
│   ├── components/
│   │   ├── AppShell.tsx
│   │   ├── Header.tsx
│   │   └── Sidebar.tsx
│   │
│   ├── lib/
│   │   └── api.ts
│   │
│   └── package.json
│
├── server/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── student.controller.js
│   │   │   ├── plan.controller.js
│   │   │   ├── attendance.controller.js
│   │   │   ├── performance.controller.js
│   │   │   ├── progress.controller.js
│   │   │   ├── user.controller.js
│   │   │   └── dashboard.controller.js
│   │   │
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Student.js
│   │   │   ├── Branch.js
│   │   │   ├── Plan.js
│   │   │   ├── Attendance.js
│   │   │   └── Performance.js
│   │   │
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── student.routes.js
│   │   │   ├── plan.routes.js
│   │   │   ├── attendance.routes.js
│   │   │   ├── performance.routes.js
│   │   │   ├── progress.routes.js
│   │   │   ├── user.routes.js
│   │   │   └── dashboard.routes.js
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js
│   │   │   └── role.middleware.js
│   │   │
│   │   └── server.js
│   │
│   ├── .env
│   └── package.json
│
└── README.md