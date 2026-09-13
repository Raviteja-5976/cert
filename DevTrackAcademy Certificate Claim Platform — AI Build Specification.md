# DevTrackAcademy Certificate Claim Platform

## 1. Project Overview

Build a temporary web application for DevTrackAcademy students to securely claim their workshop certificates.

The platform will initially support approximately 130 students.

The application must:

1. Allow only pre-registered workshop students to claim certificates.
2. Authenticate students using email OTP through Supabase Auth.
3. Display the student's pre-registered name after authentication.
4. Require the student to confirm their certificate name.
5. Collect workshop feedback before certificate issuance.
6. Generate a personalized PDF certificate.
7. Store the certificate securely.
8. Allow the student to download their certificate.
9. Send the certificate PDF to the student's email.
10. Display an interview-platform promo code.
11. Display a link/instructions for claiming free developer tools worth ₹2 lakh+.
12. Display workshop resources.
13. Allow students to return later using email OTP and access their certificate, promo code, and resources.
14. Provide a simple admin dashboard for monitoring claims and handling failed emails.
15. Provide a public certificate verification page.

This is intentionally a lightweight, temporary application. Do not over-engineer it with microservices, Kubernetes, Redis, or a separate authentication system.

---

# 2. Recommended Technology Stack

## Frontend

- Next.js
- TypeScript
- Tailwind CSS
- Responsive design
- Mobile-first UI

## Authentication

- Supabase Auth
- Passwordless email OTP
- Supabase-managed sessions

## Database

- Supabase PostgreSQL

## Authorization

- Supabase Row Level Security (RLS)

## Storage

- Supabase Storage
- Private certificate bucket

## Authentication Email

Use the already configured SpaceMail SMTP through Supabase Auth.

SpaceMail is responsible for:

- OTP emails
- Magic links if enabled

Do not implement a custom OTP system.

## Application Email

Use Brevo for application-generated emails.

Brevo is responsible for:

- Certificate email
- Certificate PDF attachment
- Other transactional emails

Never expose Brevo API credentials to the browser.

All Brevo API calls must happen server-side.

## Hosting

The application should be deployable to Vercel.

The architecture should also work on other Node.js hosting platforms.

---

# 3. High-Level Architecture

```text
                         Student
                            |
                            v
                    Next.js Web App
                            |
             +--------------+--------------+
             |                             |
             v                             v
       Supabase Auth                 Next.js Server
             |                             |
             v                       +-----+------+
       SpaceMail SMTP                |            |
             |                       v            v
             v                 Supabase DB    Brevo API
           OTP                       |            |
                                     |            v
                                     v       Certificate Email
                              Supabase Storage
                                     |
                                     v
                                  PDF
```

---

# 4. Main Student Flow

## Step 1 — Landing Page

The student visits:

```text
/certificate
```

Show:

```text
DevTrackAcademy

Claim Your Workshop Certificate

Enter the email address you used while registering
for the workshop.

[ Email Address ]

[ Continue ]
```

Include a short note:

> Only students registered for this workshop can claim a certificate.

Do not expose the complete student list.

---

# 5. Email Verification

When the student enters their email:

1. Normalize the email:
   - trim whitespace
   - convert to lowercase

2. Check whether the email belongs to an eligible student.

3. Do not reveal sensitive information about whether an email exists.

Preferred UX:

```text
If this email is registered for the workshop,
you will receive a verification code.
```

4. Trigger Supabase Auth email OTP.

5. Student receives OTP through the configured Supabase SMTP provider.

6. Display OTP input.

Example:

```text
Check your email

We sent a verification code to:

ravi@example.com

[ _ _ _ _ _ _ ]

Didn't receive the code?

[ Resend Code ]

[ Change Email ]
```

Implement a resend cooldown.

Recommended:

```text
60 seconds
```

Do not allow unlimited rapid OTP requests.

---

# 6. Authentication

Use Supabase Auth's email OTP functionality.

Do NOT build:

- custom OTP generation
- custom OTP database table
- custom OTP verification
- passwords
- authentication tokens

Supabase Auth should manage authentication.

After successful OTP verification:

```text
Supabase Auth User
        |
        v
Authenticated Session
        |
        v
Find Student Record
```

The authenticated student's email must be matched against the preloaded student record.

---

# 7. Student Record

Students are preloaded before the application launches.

Example:

```text
students

id
email
name
workshop_id
eligible
created_at
```

Example:

```text
id: UUID
email: ravi@example.com
name: Ravi Teja Karnati
workshop_id: docker-workshop-2026
eligible: true
```

The student's name in this table is the source of truth.

Students must NOT be able to modify the name themselves.

---

# 8. Name Confirmation Screen

After successful authentication, display:

```text
Almost there!

This is the name that will appear on your certificate:

--------------------------------
Ravi Teja Karnati
--------------------------------

Is this name correct?

[ Yes, Continue ]

[ No, My Name Is Incorrect ]
```

If the student selects:

### Yes

Continue to feedback.

### No

Show:

```text
Please contact DevTrackAcademy before continuing.

Your certificate name cannot be changed from this page.

[ Contact DevTrackAcademy ]
```

Do not provide an editable name field.

The database value must remain unchanged.

---

# 9. Feedback Form

After confirming their name, show the feedback form.

Title:

```text
Workshop Feedback

Your feedback helps us improve future
DevTrackAcademy workshops.

This should take approximately 2 minutes.
```

## Questions

### Question 1

How would you rate the workshop overall?

Options:

```text
1  2  3  4  5
```

Required.

---

### Question 2

How well do you understand the concepts covered in the workshop?

Options:

```text
1  2  3  4  5
```

Required.

---

### Question 3

How confident are you in implementing the projects yourself?

Options:

```text
1  2  3  4  5
```

Required.

---

### Question 4

How would you rate the resource person?

Options:

```text
1  2  3  4  5
```

Required.

---

### Question 5

What did you like most about the workshop?

Type:

```text
Textarea
```

Required.

---

### Question 6

What did you dislike about the workshop?

Type:

```text
Textarea
```

Optional or required based on UX preference.

Prefer optional because students may genuinely have nothing negative to report.

---

### Question 7

What could we improve from our side?

Type:

```text
Textarea
```

Required.

---

### Question 8

Would you be interested in an internship opportunity from DevTrackAcademy?

Options:

```text
Yes
Maybe
No
```

Required.

---

# 10. Feedback Validation

The server must validate the submitted feedback.

Do not rely only on client-side validation.

Ratings must be:

```text
1 <= rating <= 5
```

Text fields should have reasonable maximum lengths.

Suggested limits:

```text
liked: 2000 characters
disliked: 2000 characters
improvements: 2000 characters
```

Reject invalid submissions.

---

# 11. Prevent Duplicate Feedback

A student should only be able to submit feedback once for a particular workshop.

Database constraint:

```text
UNIQUE(student_id, workshop_id)
```

If the student already submitted feedback:

```text
Do not show the feedback form again.

Proceed directly to the certificate/dashboard.
```

This is important because students may refresh the page or return later.

---

# 12. Certificate Claim

After successful feedback submission:

```text
Feedback submitted ✓

Preparing your certificate...
```

The server should then:

1. Check whether a certificate already exists.
2. If it exists, reuse it.
3. If it doesn't exist:
   - generate certificate number
   - generate PDF
   - upload PDF to Supabase Storage
   - create certificate record
   - send email through Brevo
4. Return certificate information.

Certificate generation must be idempotent.

Never generate multiple certificates for the same student/workshop combination.

---

# 13. Certificate Database

Use a table:

```text
certificate_claims

id
student_id
workshop_id
certificate_number
certificate_path
claimed_at
email_sent
email_sent_at
created_at
updated_at
```

Add a unique constraint:

```text
UNIQUE(student_id, workshop_id)
```

Certificate number example:

```text
DTA-2026-DVOPS-000127
```

The format should be configurable per workshop.

---

# 14. Certificate PDF

Generate a professional DevTrackAcademy certificate.

Certificate should include:

```text
DevTrackAcademy

Certificate of Completion

This certificate is proudly presented to

Ravi Teja Karnati

for successfully completing

DevOps & Docker Workshop

[Workshop Date]

Certificate ID:
DTA-2026-DVOPS-000127

DevTrackAcademy

[QR CODE]
Scan to verify this certificate
```

The exact certificate design should be implemented using a reusable template.

Keep certificate generation server-side.

Do not trust certificate data sent from the browser.

The server should obtain:

```text
student.name
workshop.name
certificate_number
workshop.date
```

from the database.

---

# 15. Certificate QR Code

Generate a QR code for every certificate.

QR destination:

```text
/verify/{certificate_number}
```

Example:

```text
https://certificates.devtrackacademy.com/verify/DTA-2026-DVOPS-000127
```

The verification page should be publicly accessible.

Do not expose the student's email.

---

# 16. Certificate Verification Page

Route:

```text
/verify/[certificateNumber]
```

Valid certificate:

```text
✓ Certificate Verified

This is a valid DevTrackAcademy certificate.

Name:
Ravi Teja Karnati

Workshop:
DevOps & Docker Workshop

Issued:
September 2026

Certificate ID:
DTA-2026-DVOPS-000127

Issued by:
DevTrackAcademy
```

Invalid certificate:

```text
Certificate Not Found

The certificate ID you entered could not be verified.
```

Do not reveal unnecessary database information.

---

# 17. Certificate Storage

Create a private Supabase Storage bucket:

```text
certificates
```

Suggested structure:

```text
certificates/
    {workshop_id}/
        {certificate_number}.pdf
```

Example:

```text
certificates/
    docker-workshop-2026/
        DTA-2026-DVOPS-000127.pdf
```

Do not make the entire storage bucket public.

Generate temporary signed URLs for downloads.

---

# 18. Certificate Dashboard

After certificate generation, redirect to:

```text
/dashboard
```

The dashboard is the main page students see when they return.

Design it as a clean card-based dashboard.

Example:

```text
------------------------------------------------

Congratulations, Ravi Teja! 🎉

Your DevTrackAcademy certificate is ready.

[ View Certificate ]
[ Download Certificate ]

------------------------------------------------

🎁 Interview Platform Credits

Use your exclusive promo code:

DTA2026XXXX

[ Copy Code ]

[ Claim Credits ]

------------------------------------------------

🛠 Developer Tools Worth ₹2 Lakh+

Learn how to claim your free developer tools.

[ View Claim Guide ]

------------------------------------------------

📚 Workshop Resources

Access the workshop materials and resources.

[ Access Workshop Resources ]

------------------------------------------------

Certificate ID:
DTA-2026-DVOPS-000127

------------------------------------------------
```

---

# 19. Returning Student Flow

A student who already claimed the certificate should NOT repeat the entire flow.

Returning flow:

```text
/certificate
       |
       v
Enter email
       |
       v
OTP
       |
       v
Authenticated
       |
       v
Check certificate_claims
       |
       v
Certificate exists
       |
       v
/dashboard
```

They should NOT have to:

- confirm name again
- submit feedback again
- generate another certificate

---

# 20. Workshop Resources

The workshop should have configurable resources.

Example:

```text
Workshop Resources

GitHub Repository
[ Open Repository ]

Workshop Slides
[ View Slides ]

Project Source Code
[ View Projects ]

Recording
[ Watch Recording ]
```

Do not hardcode these directly throughout the frontend.

Store them in the workshop configuration.

---

# 21. Interview Platform Promo Code

The workshop should have a promo-code configuration.

If all students receive the same code:

```text
workshops

promo_code
interview_platform_url
```

If each student receives a unique code, create:

```text
promo_codes

id
student_id
workshop_id
code
claimed_at
```

The system should support both approaches if practical.

For the first version, a single workshop-level promo code is sufficient unless the external platform requires unique codes.

Add a:

```text
[ Copy Code ]
```

button.

When clicked:

```text
Copied!
```

Show a clear confirmation.

---

# 22. Developer Tools Offer

Add a section:

```text
Developer Tools Worth ₹2 Lakh+

DevTrackAcademy students can claim access
to selected developer tools and benefits.

[ Learn How To Claim ]
```

The URL should be configurable in the workshop record.

Do not make claims about tool value dynamically unless the provided content explicitly supports it.

---

# 23. Email Architecture

There are two different email systems.

## Authentication Emails

Supabase Auth:

```text
Supabase Auth
      ↓
SpaceMail SMTP
      ↓
Student
```

Used for:

- OTP
- Magic links

Do not send OTP through Brevo if SpaceMail is the configured Supabase SMTP provider.

---

## Certificate Email

Application server:

```text
Next.js server
      ↓
Brevo API
      ↓
Student
```

The Brevo API key must be stored in environment variables.

Never expose it as:

```text
NEXT_PUBLIC_BREVO_API_KEY
```

Never.

Use:

```text
BREVO_API_KEY
```

only on the server.

---

# 24. Certificate Email

Email subject:

```text
Your DevTrackAcademy Certificate is Ready 🎓
```

Email should contain:

```text
Hi Ravi,

Congratulations on successfully completing the
DevTrackAcademy DevOps & Docker Workshop.

Your certificate is now ready.

Certificate ID:
DTA-2026-DVOPS-000127

Your certificate is attached to this email as a PDF.

You can also access your certificate and workshop
resources from your DevTrackAcademy certificate dashboard.

[ View Dashboard ]

Regards,
DevTrackAcademy
```

Attach the generated PDF.

Do not regenerate the certificate just because an email is being resent.

---

# 25. Email Failure Handling

Certificate generation and email sending are separate operations.

Possible state:

```text
Certificate generated ✓
Email failed ✗
```

The student should still be able to download the certificate.

Dashboard should display:

```text
Your certificate is ready.

[ Download Certificate ]

We couldn't send the certificate email.
You can still download it here.

[ Resend Certificate Email ]
```

Admin should also be able to retry the email.

---

# 26. Admin Dashboard

Create:

```text
/admin
```

Protect it separately.

Do NOT rely on hiding the URL.

Admin authentication should be based on a secure mechanism such as:

- Supabase Auth + admin role
- allowlisted admin email(s)
- server-side authorization

Do not expose admin functionality to normal students.

---

# 27. Admin Dashboard Overview

Display:

```text
Certificate Claim Dashboard

Total Students:       130
Certificates Claimed: 87
Not Yet Claimed:      43
Feedback Submitted:   87
Emails Sent:          85
Email Failed:          2
```

---

# 28. Admin Student Table

Show:

```text
Student
Email
Workshop
Feedback
Certificate
Email
Claimed At
Actions
```

Example:

```text
Ravi Teja     ravi@...    ✓    ✓    ✓
Anil Kumar    anil@...    ✓    ✓    ✗
Priya Sharma  priya@...   —    —    —
```

Actions:

```text
View
Resend Certificate
```

Do not display unnecessary sensitive information.

---

# 29. Admin Feedback Analytics

Provide basic aggregation.

For example:

```text
Workshop Rating

Average: 4.6 / 5

5 ★  ███████████
4 ★  ███████
3 ★  ██
2 ★
1 ★
```

Also show:

```text
Average Understanding: 4.4 / 5
Average Implementation Confidence: 4.1 / 5
Average Resource Person Rating: 4.7 / 5
```

Internship interest:

```text
Yes:   72
Maybe: 11
No:     4
```

The first version does not need advanced analytics.

---

# 30. Database Schema

Implement approximately the following.

## workshops

```text
id UUID PRIMARY KEY
name TEXT NOT NULL
slug TEXT UNIQUE NOT NULL
description TEXT
workshop_date DATE
certificate_prefix TEXT
promo_code TEXT
interview_platform_url TEXT
dev_tools_url TEXT
resources JSONB
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Example `resources`:

```json
[
  {
    "title": "GitHub Repository",
    "url": "https://..."
  },
  {
    "title": "Workshop Slides",
    "url": "https://..."
  }
]
```

---

## students

```text
id UUID PRIMARY KEY
email TEXT NOT NULL
name TEXT NOT NULL
workshop_id UUID REFERENCES workshops(id)
eligible BOOLEAN DEFAULT TRUE
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Add:

```text
UNIQUE(email, workshop_id)
```

---

## feedback

```text
id UUID PRIMARY KEY
student_id UUID REFERENCES students(id)
workshop_id UUID REFERENCES workshops(id)

workshop_rating INTEGER
understanding_rating INTEGER
implementation_rating INTEGER
resource_person_rating INTEGER

liked TEXT
disliked TEXT
improvements TEXT

internship_interest TEXT

created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Constraint:

```text
UNIQUE(student_id, workshop_id)
```

---

## certificate_claims

```text
id UUID PRIMARY KEY
student_id UUID REFERENCES students(id)
workshop_id UUID REFERENCES workshops(id)

certificate_number TEXT UNIQUE NOT NULL
certificate_path TEXT NOT NULL

claimed_at TIMESTAMPTZ

email_sent BOOLEAN DEFAULT FALSE
email_sent_at TIMESTAMPTZ

created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Constraint:

```text
UNIQUE(student_id, workshop_id)
```

---

# 31. Row Level Security

RLS must be enabled.

Students should only be able to access their own data.

Conceptually:

```text
authenticated user
       |
       v
match auth.email()
       |
       v
student.email
```

Students must not be able to:

- read all students
- read other students' feedback
- modify their name
- modify their eligibility
- modify certificate number
- modify certificate paths
- access admin data

Sensitive operations should be performed server-side.

---

# 32. Important Security Rules

Never trust:

```text
student_id
name
certificate_number
email
workshop_id
```

sent by the client.

For authenticated requests:

```text
Supabase session
      ↓
authenticated email
      ↓
student record
      ↓
server retrieves actual student data
```

The server determines the student identity.

---

# 33. Environment Variables

Use environment variables.

Example:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=

BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=

ADMIN_EMAIL=
```

Never expose:

```text
SUPABASE_SERVICE_ROLE_KEY
BREVO_API_KEY
```

to the client.

---

# 34. API / Server Operations

Create server-side operations approximately like:

```text
POST /api/certificate/claim
POST /api/certificate/resend
GET  /api/certificate/download
GET  /api/certificate/verify/[id]
```

However, prefer Next.js Server Actions where appropriate rather than creating unnecessary API routes.

The important requirement is that privileged operations remain server-side.

---

# 35. Certificate Claim Algorithm

Implement approximately:

```text
1. Verify Supabase session.

2. Identify authenticated user.

3. Find student using authenticated email.

4. Verify student is eligible.

5. Check whether feedback exists.

6. If feedback does not exist:
      reject certificate generation.

7. Check certificate_claims.

8. If certificate exists:
      return existing certificate.

9. Otherwise:
      generate certificate number.

10. Generate PDF.

11. Upload PDF to Supabase Storage.

12. Insert certificate_claim.

13. Send certificate email through Brevo.

14. If email succeeds:
      email_sent = true

15. If email fails:
      certificate remains valid
      email_sent = false

16. Return dashboard information.
```

Make steps 8–12 transaction-safe and protected against duplicate requests/race conditions.

---

# 36. UI/UX Requirements

The site should look professional and polished.

Brand:

```text
DevTrackAcademy
```

Use a modern education/technology aesthetic.

Requirements:

- responsive
- mobile-first
- clean typography
- generous spacing
- clear buttons
- accessible form controls
- clear success/error states
- loading indicators
- no unnecessary animations
- no excessive gradients
- no clutter

The primary goal is trust and simplicity.

---

# 37. Loading States

Every async operation must have a visible loading state.

Examples:

```text
Sending code...
Verifying...
Submitting feedback...
Generating certificate...
Sending email...
Loading dashboard...
```

Do not let the user click buttons repeatedly while an operation is running.

Disable the submit button during requests.

---

# 38. Error Handling

Create friendly errors.

Examples:

### Invalid OTP

```text
The verification code is incorrect or expired.
Please try again.
```

### Email not eligible

Do not reveal unnecessary information.

```text
If this email is registered for the workshop,
a verification code will be sent.
```

### Certificate generation failure

```text
We couldn't generate your certificate right now.

Your feedback has been saved.
Please try again in a moment.
```

### Email failure

```text
Your certificate is ready, but we couldn't send
the email.

You can download it below.
```

---

# 39. Prevent Common Problems

The implementation must handle:

- double-clicking Submit
- refreshing during certificate generation
- reopening the dashboard
- expired OTP
- repeated OTP requests
- certificate generation being triggered twice
- Brevo failure
- Supabase Storage failure
- network interruption
- student opening multiple tabs

Certificate generation must remain idempotent.

---

# 40. Routing

Suggested routes:

```text
/
        Landing / redirect

/certificate
        Certificate claim flow

/dashboard
        Authenticated student dashboard

/verify/[certificateNumber]
        Public certificate verification

/admin
        Admin dashboard
```

Optional:

```text
/admin/feedback
/admin/students
/admin/certificates
```

Only create these if needed.

---

# 41. Suggested Project Structure

Use a clean structure similar to:

```text
src/
├── app/
│   ├── page.tsx
│   ├── certificate/
│   │   └── page.tsx
│   │
│   ├── dashboard/
│   │   └── page.tsx
│   │
│   ├── verify/
│   │   └── [certificateNumber]/
│   │       └── page.tsx
│   │
│   ├── admin/
│   │   └── page.tsx
│   │
│   └── api/
│       └── ...
│
├── components/
│   ├── auth/
│   ├── certificate/
│   ├── feedback/
│   ├── dashboard/
│   └── admin/
│
├── lib/
│   ├── supabase/
│   ├── brevo/
│   ├── certificate/
│   └── auth/
│
├── types/
│
└── utils/
```

Do not put secrets in client components.

---

# 42. Data Import

Provide a simple way to import the initial 130 students.

Preferred format:

```text
email,name
ravi@example.com,Ravi Teja Karnati
student2@example.com,Student Two
student3@example.com,Student Three
```

Create either:

1. SQL seed script
2. CSV import script
3. Admin-only import functionality

For this one-off project, a SQL/CSV seed script is sufficient.

Do not require manually entering 130 students.

---

# 43. Workshop Configuration

The system should not hardcode the workshop name everywhere.

Create one workshop record:

```text
DevOps & Docker Workshop
```

Then configure:

```text
workshop name
date
certificate title
certificate prefix
promo code
interview URL
dev tools URL
resources
```

This makes the application reusable for another workshop if required.

---

# 44. Privacy

Do not publicly expose:

- student emails
- complete student list
- feedback responses
- admin data

The public verification page should expose only certificate-related information.

Never expose feedback publicly.

---

# 45. Logging

Add useful server logs for:

```text
OTP authentication errors
certificate generation
certificate upload
Brevo email success/failure
certificate resend
```

Do not log:

- OTP codes
- authentication tokens
- API keys
- unnecessary personal information

---

# 46. Analytics

For this one-off application, avoid adding a large analytics platform unless necessary.

Basic database statistics are enough.

Useful metrics:

```text
total students
total claims
claim percentage
average workshop rating
average understanding rating
average implementation rating
average resource-person rating
internship interest
email failures
```

---

# 47. Completion Criteria

The application is considered complete when:

### Authentication

- [ ] Student enters email.
- [ ] Supabase OTP is sent.
- [ ] Student can verify OTP.
- [ ] Authentication session persists.
- [ ] Unregistered users cannot claim certificates.

### Student verification

- [ ] Correct registered name is displayed.
- [ ] Student cannot directly edit the name.
- [ ] Incorrect-name path is available.

### Feedback

- [ ] All required ratings validate.
- [ ] Text fields validate.
- [ ] Internship question works.
- [ ] Feedback is saved.
- [ ] Duplicate feedback is prevented.

### Certificate

- [ ] Certificate number is unique.
- [ ] Certificate PDF is generated.
- [ ] Student name comes from the database.
- [ ] PDF is stored in Supabase Storage.
- [ ] Certificate is downloadable.
- [ ] Certificate is not regenerated unnecessarily.
- [ ] QR code works.

### Email

- [ ] Certificate email is sent through Brevo.
- [ ] PDF is attached.
- [ ] Email failure does not invalidate certificate.
- [ ] Failed emails can be resent.

### Dashboard

- [ ] Returning students can log in with OTP.
- [ ] Certificate is displayed.
- [ ] Download works.
- [ ] Promo code is displayed.
- [ ] Promo code can be copied.
- [ ] Interview platform link works.
- [ ] Developer tools guide works.
- [ ] Workshop resources work.

### Verification

- [ ] Valid certificate ID shows valid certificate.
- [ ] Invalid certificate ID shows appropriate error.
- [ ] Student email is never exposed.

### Admin

- [ ] Admin route is protected.
- [ ] Student claim status is visible.
- [ ] Email failure status is visible.
- [ ] Certificate can be resent.
- [ ] Feedback summary is available.

---

# 48. Development Order

Build in this order.

## Phase 1 — Foundation

1. Create Next.js project.
2. Configure Tailwind.
3. Configure Supabase.
4. Create database tables.
5. Configure RLS.
6. Seed students.

## Phase 2 — Authentication

7. Implement email input.
8. Implement Supabase OTP.
9. Implement session handling.
10. Match authenticated user to student.

## Phase 3 — Claim Flow

11. Name confirmation.
12. Feedback form.
13. Feedback validation.
14. Feedback persistence.

## Phase 4 — Certificate

15. Create certificate template.
16. Generate PDF.
17. Generate certificate ID.
18. Generate QR code.
19. Upload to Supabase Storage.
20. Implement download.
21. Implement public verification.

## Phase 5 — Email

22. Configure Brevo.
23. Implement certificate email.
24. Attach PDF.
25. Implement email failure handling.
26. Implement resend.

## Phase 6 — Dashboard

27. Create student dashboard.
28. Add certificate.
29. Add promo code.
30. Add interview platform.
31. Add developer tools.
32. Add workshop resources.

## Phase 7 — Admin

33. Add protected admin page.
34. Add student status.
35. Add feedback statistics.
36. Add resend email.

## Phase 8 — Testing

37. Test Gmail.
38. Test Outlook.
39. Test college email.
40. Test OTP expiry.
41. Test duplicate submissions.
42. Test refresh during certificate generation.
43. Test multiple tabs.
44. Test failed email.
45. Test certificate verification.
46. Test mobile UI.

---

# 49. Important Implementation Principle

Do not blindly implement the entire application in one huge generated codebase.

Build it incrementally.

After each phase:

1. Run the application.
2. Test it.
3. Fix errors.
4. Commit the changes.
5. Continue to the next phase.

The AI coding agent should keep the application runnable after every phase.

---

# 50. Final Desired Experience

The entire student experience should feel like:

```text
DevTrackAcademy
       |
       v
Enter Email
       |
       v
OTP Verification
       |
       v
Confirm Certificate Name
       |
       v
Workshop Feedback
       |
       v
Certificate Generated
       |
       v
🎉 Congratulations
       |
       +-------------------+
       |                   |
       v                   v
Certificate          Student Benefits
       |                   |
       |             +-----+-------+
       |             |             |
       v             v             v
   Download      Promo Code    Dev Tools
                   |
                   v
              Resources
```

When the student returns:

```text
Email
  ↓
OTP
  ↓
Dashboard
```

No repeated feedback.

No repeated certificate generation.

No passwords.

No complicated account creation.

---

# 51. Important Things NOT To Build

Do not add unnecessary complexity.

Do not build:

- Custom authentication
- Custom OTP system
- Password authentication
- Microservices
- Kubernetes
- Redis
- Message queues
- Separate MySQL database
- Custom SMTP server
- Complex CMS
- Full LMS
- Student profile management
- Public student directory
- Complex analytics platform

The application is designed for approximately 130 students and is intended to be temporary.

Keep it simple, secure, reliable, and easy to remove later.