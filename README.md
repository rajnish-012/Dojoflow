# 🥋 DojoFlow

### Karate Academy Management System

DojoFlow is a full-stack Karate Academy Management System built to simplify academy operations such as student admission, training plans, curriculum management, attendance tracking, performance evaluation, progress tracking, and role-based access control.

The system provides dedicated dashboards and permissions for **Super Admins, Branch Admins, Coaches, and Students**.

---

## ✨ Features

### 🔐 Authentication & Authorization

- JWT-based authentication
- Secure password hashing with bcrypt
- Login and registration
- Role-based access control
- Protected frontend routes
- Protected backend APIs
- Persistent authentication using local storage
- Secure logout

### 👥 Role-Based Access

| Role | Access |
|---|---|
| **Super Admin** | Full system access |
| **Branch Admin** | Branch-level management |
| **Coach** | Training and student operations |
| **Student** | Personal student portal |

---

## 👨‍💼 Super Admin

Super Admins have complete access to the academy management system.

### Available modules

- Dashboard
- Students
- Training Plans
- Curriculum
- Attendance
- Performance
- Staff Management
- Settings

### Capabilities

- Manage students
- Create and manage training plans
- Manage curriculum
- Track attendance
- Evaluate student performance
- Manage staff accounts
- Delete students
- View academy-level information

---

## 🏢 Branch Admin

Branch Admins manage operations within their assigned branch.

### Available modules

- Dashboard
- Students
- Training Plans
- Curriculum
- Attendance
- Performance

Branch Admins cannot access Super Admin-only settings and are restricted to their assigned branch.

---

## 🥋 Coach

Coaches can manage day-to-day training activities.

### Available modules

- Dashboard
- Students
- Curriculum
- Attendance
- Performance

Coaches can:

- View students in their branch
- View training curriculum
- Mark attendance
- Evaluate student performance

---

## 🧑‍🎓 Student Portal

Students have a dedicated portal instead of accessing the management dashboard.

### Student features

- Personal profile
- Current belt
- Training plan
- Branch information
- Join date
- Contact information
- Plan information
- Training progress
- Attendance
- Performance history

Students can only access information associated with their own account.

---

# 📊 Dashboard

The dashboard provides an overview of academy operations.

It includes information such as:

- Total students
- Active students
- Training plans
- Attendance
- Student progress
- Academy statistics

Dashboard information is retrieved from the backend API.

---

# 👤 Student Management

Administrators can admit new students by providing:

- Student name
- Age
- Phone number
- Contact email
- Branch
- Training plan
- Join date
- Student login email
- Student login password

When a student is admitted, DojoFlow creates:

```text
User Account
     │
     │ linked through User ID
     ▼
Student Profile
```

The user account receives:

```text
role = STUDENT
```

The student profile stores the corresponding user reference.

This allows the application to securely identify the logged-in student's own profile.

---

# 🔑 Student Authentication Flow

The student login flow works as follows:

```text
Student Login
      │
      ▼
JWT Authentication
      │
      ▼
Role = STUDENT
      │
      ▼
/student-dashboard
      │
      ▼
GET /api/students/me
      │
      ▼
Student Profile
```

The backend determines the student using the authenticated user's ID instead of accepting an arbitrary student ID.

This prevents a student from changing an ID in the URL to access another student's profile.

---

# 📚 Training Plans

Administrators can create and manage training plans.

A plan can contain:

- Plan name
- Price
- Duration
- Classes per week
- Starting belt
- Milestones
- Day-wise curriculum

Example:

```text
Training Plan
│
├── Duration
├── Price
├── Starting Belt
├── Classes / Week
│
├── Curriculum
│   ├── Day 1
│   ├── Day 2
│   ├── Day 3
│   └── ...
│
└── Milestones
    ├── Milestone 1
    ├── Milestone 2
    └── ...
```

---

# 🥋 Curriculum Management

Curriculum is associated with training plans and organized by training day.

Each training day can contain the techniques and activities students are expected to learn.

Example:

```text
Day 1
 ├── Basic Stance
 ├── Basic Punch
 └── Basic Block

Day 2
 ├── Footwork
 ├── Kicks
 └── Combinations
```

This structure allows coaches to follow a defined training program.

---

# 📅 Attendance Management

Coaches and administrators can record student attendance.

Attendance is associated with:

- Student
- Training date
- Training session
- Curriculum
- Branch

The system supports date-based attendance filtering and prevents duplicate attendance records for the same applicable session.

Branch-level users only access attendance relevant to their branch.

---

# ⭐ Performance Evaluation

Coaches can evaluate student performance using a 1–5 star rating system.

```text
⭐     1 - Needs Improvement
⭐⭐    2
⭐⭐⭐   3
⭐⭐⭐⭐  4
⭐⭐⭐⭐⭐ 5 - Excellent
```

Performance evaluations can include:

- Student
- Training day
- Curriculum
- Rating
- Remarks
- Evaluation date

Performance history can be viewed from the management interface.

---

# 📈 Progress Tracking

DojoFlow tracks student training progress based on their assigned training plan.

Progress information includes:

- Current training day
- Completed training days
- Remaining training days
- Progress percentage
- Training plan information

The progress system is designed to support long-term student development and belt progression.

---

# 🛡️ Security

DojoFlow uses multiple layers of security.

### Backend authentication

Protected APIs require a valid JWT:

```http
Authorization: Bearer <token>
```

### Role-based authorization

Backend routes verify the user's role before allowing access.

For example:

```text
SUPER_ADMIN
BRANCH_ADMIN
COACH
STUDENT
```

### Student data isolation

Students use:

```http
GET /api/students/me
```

rather than requesting an arbitrary student ID.

The backend uses the authenticated JWT identity:

```js
Student.findOne({
  user: req.user._id
});
```

Therefore, students cannot access another student's profile simply by changing a URL parameter.

---

# 🛠️ Tech Stack

## Frontend

- **Next.js**
- **React**
- **TypeScript**
- **Tailwind CSS**
- **Lucide React**
- **Next.js App Router**

## Backend

- **Node.js**
- **Express.js**
- **MongoDB**
- **Mongoose**
- **JWT**
- **bcryptjs**

## Database

- MongoDB

---

# 🏗️ Architecture

DojoFlow follows a frontend/backend architecture:

```text
┌───────────────────────────────┐
│          Next.js              │
│          Frontend             │
│                               │
│  Dashboard                    │
│  Students                     │
│  Plans                        │
│  Curriculum                   │
│  Attendance                   │
│  Performance                  │
│  Student Portal               │
└───────────────┬───────────────┘
                │
                │ REST API
                │ JWT
                ▼
┌───────────────────────────────┐
│          Express.js           │
│           Backend             │
│                               │
│  Authentication               │
│  Authorization                │
│  Student Management           │
│  Plans                        │
│  Attendance                   │
│  Performance                  │
│  Progress                     │
└───────────────┬───────────────┘
                │
                │ Mongoose
                ▼
┌───────────────────────────────┐
│           MongoDB             │
│                               │
│  Users                        │
│  Students                     │
│  Branches                     │
│  Plans                        │
│  Attendance                   │
│  Performance                  │
└───────────────────────────────┘
```

---

# 📁 Project Structure

```text
DojoFlow/
│
├── client/
│   ├── app/
│   │   ├── dashboard/
│   │   ├── students/
│   │   ├── plans/
│   │   ├── curriculum/
│   │   ├── attendance/
│   │   ├── performance/
│   │   ├── student-dashboard/
│   │   ├── settings/
│   │   ├── login/
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
│   ├── public/
│   ├── package.json
│   └── package-lock.json
│
├── server/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── server.js
│   │
│   ├── package.json
│   └── package-lock.json
│
├── README.md
└── .gitignore
```

---

# ⚙️ Requirements

Make sure the following are installed:

- Node.js 18+
- npm
- MongoDB

---

# 🚀 Installation

Clone the repository:

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
```

Move into the project:

```bash
cd DojoFlow
```

---

# 🔧 Backend Setup

Navigate to the server:

```bash
cd server
```

Install dependencies:

```bash
npm install
```

Create a `.env` file:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/dojoflow
JWT_SECRET=your_secret_key
```

Start the backend:

```bash
npm run dev
```

The backend will run on:

```text
http://localhost:5000
```

Expected output:

```text
DojoFlow server running on port 5000
MongoDB connected: 127.0.0.1
```

---

# 💻 Frontend Setup

Open another terminal.

Navigate to:

```bash
cd client
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend will run on:

```text
http://localhost:3000
```

Open the application in your browser:

```text
http://localhost:3000
```

---

# 🔐 Environment Variables

Do not commit real secrets to GitHub.

Create:

```text
server/.env
```

with your local configuration.

For GitHub, provide:

```text
server/.env.example
```

Example:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/dojoflow
JWT_SECRET=your_secret_here
```

The real `.env` file should be included in `.gitignore`.

---

# 📡 API Endpoints

## Authentication

```http
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

## Students

```http
GET    /api/students
GET    /api/students/me
GET    /api/students/:id
POST   /api/students
PUT    /api/students/:id
DELETE /api/students/:id
```

## Plans

```http
GET    /api/plans
GET    /api/plans/:id
POST   /api/plans
PUT    /api/plans/:id
DELETE /api/plans/:id
```

## Attendance

```http
GET  /api/attendance
POST /api/attendance
```

## Performance

```http
GET  /api/performance
POST /api/performance
```

## Progress

```http
GET /api/progress/student/:studentId
```

## Staff / Users

```http
GET    /api/users
POST   /api/users
DELETE /api/users/:id
```

## Dashboard

```http
GET /api/dashboard
```

---

# 🖥️ Frontend Routes

### Authentication

```text
/login
```

### Management

```text
/dashboard
/students
/plans
/curriculum
/attendance
/performance
/settings/staff
```

### Student

```text
/student-dashboard
```

---

# 🧪 Testing the Application

## Admin

Login using a Super Admin account and verify:

```text
Dashboard
Students
Plans
Curriculum
Attendance
Performance
Settings
```

---

## Student

Create a student from the Students module.

Provide:

```text
Student Login Email
Student Login Password
```

Logout from the admin account.

Login using the student's credentials.

The student should automatically be redirected to:

```text
/student-dashboard
```

The student portal should display the student's own:

- Profile
- Current belt
- Training plan
- Branch
- Join date
- Status

---

# 🔒 Student Access Testing

While logged in as a student, attempting to access management routes should redirect the student back to:

```text
/student-dashboard
```

Examples:

```text
/dashboard
/students
/plans
/curriculum
/attendance
/performance
/settings
```

This frontend protection is backed by backend role-based authorization.

---

# 📋 Current Status

### Completed

- [x] Project initialization
- [x] MongoDB integration
- [x] JWT authentication
- [x] Password hashing
- [x] Role-based authorization
- [x] Super Admin functionality
- [x] Branch Admin functionality
- [x] Coach functionality
- [x] Student authentication
- [x] Student profile linking
- [x] Student portal
- [x] Student management
- [x] Training plans
- [x] Day-wise curriculum
- [x] Attendance management
- [x] Performance evaluation
- [x] Progress tracking
- [x] Staff management
- [x] Role-based sidebar
- [x] Role-based header
- [x] Frontend route protection
- [x] Backend API protection

---

# 🔮 Future Improvements

Potential future enhancements include:

- Online fee/payment management
- Automated belt progression
- Attendance notifications
- Email/SMS notifications
- Advanced analytics
- Student certificates
- Coach scheduling
- Parent/guardian portal
- Payment history
- Automated progress reports
- Cloud deployment
- Production-grade refresh-token authentication

---

# 📌 Important Development Notes

The following directories should not be committed to GitHub:

```text
node_modules/
.next/
```

Sensitive environment files should also not be committed:

```text
.env
```

Use `.env.example` to document required environment variables.

---

# 🤝 Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a feature branch:

```bash
git checkout -b feature/your-feature
```

3. Make your changes.
4. Commit your changes:

```bash
git commit -m "Add your feature"
```

5. Push the branch:

```bash
git push origin feature/your-feature
```

6. Open a Pull Request.

---

# 📄 License

This project is currently intended as a project/demo application.

---

# 👨‍💻 Author

**Rajnish Kumar**

Full-Stack / MERN Developer

Built with:

```text
Next.js + TypeScript + Express + MongoDB
```

---

## ⭐ DojoFlow

A complete management platform for modern Karate Academies.

```text
🥋 Train
📚 Learn
📅 Track
⭐ Improve
🏆 Progress
```
