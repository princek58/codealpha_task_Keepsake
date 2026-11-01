# Bloomly

> "Where little moments bloom."

A cozy, warm social media web app built with Node.js, Express, MongoDB, and vanilla web technologies.

## Tech Stack (Backend)
- **Runtime & Server:** Node.js (CommonJS), Express
- **Database & ODM:** MongoDB, Mongoose
- **Authentication & Security:** bcryptjs (cost 12), jsonwebtoken (httpOnly, SameSite=Lax cookie), helmet, cors, express-mongo-sanitize, express-rate-limit, express-validator
- **File Uploads:** multer (limited to safe image formats jpg/jpeg/png/webp/gif up to 2MB)
- **Testing:** Jest, Supertest, mongodb-memory-server

## Project Setup

### 1. Prerequisites
- Node.js (v18+)
- MongoDB running locally or accessible via connection URI (e.g., MongoDB Atlas or Docker)

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Copy `.env.example` to create your local `.env` file:
```bash
cp .env.example .env
```

Ensure the following variables are defined:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/bloomly
JWT_SECRET=your_jwt_secret_change_in_production
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:5000
NODE_ENV=development
```

### 4. Running the Server

#### Development mode (with nodemon):
```bash
npm run dev
```

#### Production mode:
```bash
npm start
```

### 5. Running Automated Tests & HTTP Walkthrough
Run the entire automated test suite (in-memory MongoDB, requiring no external database):
```bash
npm test
```

Run the end-to-end multi-user HTTP verification script:
```bash
node scripts/walkthrough.js
```

## Folder Structure
```
bloomly/
├── client/
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── assets/
│       └── stickers/
├── server/
│   ├── server.js
│   ├── app.js
│   ├── config/
│   │   └── db.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Post.js
│   │   ├── Comment.js
│   │   └── Notification.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── posts.js
│   │   ├── comments.js
│   │   └── notifications.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── usersController.js
│   │   ├── postsController.js
│   │   ├── commentsController.js
│   │   └── notificationsController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── validate.js
│   │   ├── upload.js
│   │   ├── rateLimiters.js
│   │   └── errorHandler.js
│   ├── utils/
│   │   ├── formatters.js
│   │   ├── fileHelper.js
│   │   └── notificationHelper.js
│   ├── uploads/
│   └── tests/
│       ├── setup.js
│       ├── testHelper.js
│       ├── auth.test.js
│       ├── users.test.js
│       ├── posts.test.js
│       ├── comments.test.js
│       ├── notifications.test.js
│       └── upload.test.js
├── scripts/
│   └── walkthrough.js
├── .env.example
├── .env
├── .gitignore
├── API.md
├── package.json
├── PROJECT_DECISIONS.md
└── README.md
```

## Backend API Summary

See [API.md](API.md) for full endpoint specifications, request/response examples, and error schemas.

- **Auth:**
  - `POST /api/auth/register` - Create account
  - `POST /api/auth/login` - Log in
  - `POST /api/auth/logout` - Log out
  - `GET /api/auth/me` - Authenticated user profile
- **Users:**
  - `GET /api/users/search?q=` - Search users
  - `GET /api/users/suggestions` - Suggested gardeners (second-degree connections, then newest)
  - `GET /api/users/:username` - Public profile with follower/post counts
  - `GET /api/users/:username/followers` - Paginated followers
  - `GET /api/users/:username/following` - Paginated following
  - `PUT /api/users/me` - Update profile & avatar image
  - `POST /api/users/:id/follow` - Toggle follow / unfollow
- **Posts (Blooms):**
  - `POST /api/posts` - Create bloom (text and/or image)
  - `GET /api/posts/feed` - Feed from followed gardeners + self
  - `GET /api/posts/explore` - Global explore feed
  - `GET /api/posts/user/:username` - Blooms by user
  - `GET /api/posts/:id` - Single bloom
  - `DELETE /api/posts/:id` - Author deletion with cascaded cleanup
  - `POST /api/posts/:id/like` - Toggle heart (like)
- **Comments:**
  - `POST /api/posts/:id/comments` - Add comment
  - `GET /api/posts/:id/comments` - List comments (oldest first)
  - `DELETE /api/comments/:id` - Delete comment (comment or post author)
- **Notifications:**
  - `GET /api/notifications` - Paginated notifications
  - `GET /api/notifications/unread-count` - Unread notification badge count
  - `PUT /api/notifications/read` - Mark all notifications as read
  - `PUT /api/notifications/:id/read` - Mark individual notification as read
