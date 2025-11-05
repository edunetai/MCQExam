# MCQ Test Platform

A comprehensive, real-time MCQ test-taking application with a powerful admin dashboard and a seamless student testing interface. Built with React and powered by Supabase for a fully synchronized, interactive experience.

![Admin Dashboard Screenshot](https://storage.googleapis.com/aistudio-hosting/project-assets/mcq-platform-demo.png)

## Key Features

### For Administrators
- **Secure Authentication:** Admin users have dedicated credentials and a separate dashboard.
- **Test Management:** Easily create, edit, and delete tests and their questions through an intuitive modal interface.
- **Import/Export:** Quickly build tests by importing them from a simple JSON format.
- **Live Test Control:** Start, pause, resume, finish, and reset test sessions for all students in real-time.
- **Real-time Student Monitoring:** View a live dashboard of all online students, their test status (e.g., Started, In Progress, Completed), and their progress.
- **Results & Analytics:** Dive deep into test results with a detailed analytics dashboard, including:
    - Overall performance statistics (participants, average/high/low scores).
    - A visual score distribution chart to gauge class performance.
    - A detailed question-by-question breakdown of correct, incorrect, and unanswered attempts.
- **User Management:** View a list of all registered student users.
- **Audit Logging:** Track key actions performed by both admins and students for security and review.

### For Students
- **Secure Authentication:** Students can register and log in to their own accounts.
- **Profile Management:** Students can update their personal information, email, and password.
- **Real-time Test Interface:** The test environment is fully synchronized with the admin's controls. The test will start, pause, and end automatically based on the admin's actions.
- **Interactive Test Experience:**
    - Navigate between questions easily using a navigator grid.
    - Answers are saved automatically and in real-time.
    - A live timer keeps track of the remaining time.
- **Instant Final Report:** Upon submitting the test (or when time runs out), students receive an immediate summary of their performance, including their final score.

## Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS
- **Backend & Database:** Supabase (PostgreSQL, Real-time Subscriptions, Authentication, Storage)

---

## Self-Hosting Guide

Follow these steps to set up and run your own instance of the MCQ Test Platform.

### Prerequisites
- A [Supabase](https://supabase.com/) account (free tier is sufficient).
- A simple static file server to run the app locally. You can use the `serve` package (`npm install -g serve`) or Python's built-in server.

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd <repository-directory>
```

### Step 2: Set up Supabase Project

1.  Go to your [Supabase Dashboard](https://app.supabase.com/) and click **New project**.
2.  Give your project a name and a secure database password.
3.  After the project is created, navigate to **Project Settings** (the gear icon in the left sidebar).
4.  Go to the **API** section. Here you will find your **Project URL** and your `anon` **public** key. You will need these for the next step.

### Step 3: Configure Database Schema

1.  In your Supabase project, go to the **SQL Editor** (the terminal icon in the left sidebar).
2.  Click **+ New query**.
3.  Open the `supabase.md` file from this repository.
4.  Copy the **entire SQL script** from the file and paste it into the Supabase SQL Editor.
5.  **Important:** The script automatically assigns the `admin` role to the user with the email `diepho@gmail.com`. Before running, **find this line and change the email to your own desired admin email address.** You will need to do this in two places within the script.
6.  Click **Run**. This will create all the necessary tables, functions, and security policies for the application to work correctly.

### Step 4: Configure Application Secrets

The application needs to connect to your Supabase instance.

1.  Create a new file named `secrets.md` in the root of the project. This file is for your reference only and will be ignored by Git. Copy the contents of `secrets.md.example` into it and fill in your Supabase URL and anon key from Step 2.
2.  Open the file `services/supabase.ts`.
3.  You will see two placeholder variables:
    ```typescript
    const supabaseUrl = 'YOUR_SUPABASE_URL';
    const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';
    ```
4.  Replace these placeholder strings with your actual Supabase Project URL and anon key.

*Why manual replacement? This project uses browser-native ES modules without a build step, so it cannot access traditional `.env` files. For a production deployment, you would typically use a build tool like Vite or Next.js to manage environment variables securely.*

### Step 5: Run the Application

Since this is a static web application, you just need to serve the files.

**Using `serve`:**
```bash
# If you don't have it installed: npm install -g serve
serve .
```

**Using Python:**
```bash
# For Python 3
python -m http.server
```
Now, open your browser and navigate to the local address provided (e.g., `http://localhost:3000` or `http://localhost:8000`).

### Step 6: Create Your Admin User

1.  On the application's login page, click "Register".
2.  Sign up using the **exact same email address** you set as the admin in the SQL script in Step 3.
3.  Once registered, you can log in. The application will recognize your email and grant you access to the Admin Dashboard.
4.  You can now start creating tests and managing student users!
