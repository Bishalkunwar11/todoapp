# Todo App

A simple file-based todo application built with Node.js and Express. Todos are stored as individual JSON files on the server, with a clean web UI for managing them.

## Features

- Create, read, update, and delete todos
- Todos persist as JSON files (no database required)
- Toggle completion status on any todo
- Edit todo descriptions inline
- Duplicate title detection
- Rate limiting on all endpoints
- Docker support

## Project Structure

```
todoapp/
├── server.js          # Express server and REST API
├── page/
│   ├── message.html   # Main todo UI
│   └── exists.html    # Duplicate/error page
├── message/           # Todo JSON files (auto-created at startup)
├── temp/              # Temporary files during write (auto-created)
├── public/            # Static assets (auto-created)
├── Dockerfile
└── package.json
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/Bishalkunwar11/todoapp.git
cd todoapp

# Install dependencies
npm install
```

### Running the App

```bash
npm start
```

The server starts on **http://localhost:3000** by default. Set the `PORT` environment variable to use a different port:

```bash
PORT=8080 npm start
```

## Docker

### Build and run with Docker

```bash
docker build -t todoapp .
docker run -p 3000:3000 todoapp
```

## API Reference

All endpoints are rate-limited (100 reads / 30 writes per minute per IP).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Serve the main todo UI |
| `GET` | `/todos` | List all todos (JSON) |
| `POST` | `/create` | Create a new todo |
| `PUT` | `/todos/:title` | Update a todo (completed, text) |
| `DELETE` | `/todos/:title` | Delete a todo |

### Create a todo

```http
POST /create
Content-Type: application/json

{
  "title": "Buy groceries",
  "text": "Milk, eggs, bread"
}
```

**Response (201)**

```json
{
  "title": "Buy groceries",
  "text": "Milk, eggs, bread",
  "completed": false,
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

### Update a todo

```http
PUT /todos/Buy%20groceries
Content-Type: application/json

{
  "completed": true
}
```

### Delete a todo

```http
DELETE /todos/Buy%20groceries
```

## License

MIT
