const fs = require('fs').promises;
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

const PAGE_DIR = path.join(__dirname, 'page');
const TEMP_DIR = path.join(__dirname, 'temp');
const MESSAGE_DIR = path.join(__dirname, 'message');

// Rate limiters
const readLimiter = rateLimit({ windowMs: 60 * 1000, max: 100 });
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });

async function ensureDirectories() {
    await Promise.all([
        fs.mkdir(PAGE_DIR, { recursive: true }),
        fs.mkdir(TEMP_DIR, { recursive: true }),
        fs.mkdir(MESSAGE_DIR, { recursive: true }),
        fs.mkdir(path.join(__dirname, 'public'), { recursive: true }),
    ]);
}

// Sanitize title: allow alphanumeric, spaces, hyphens and underscores only
function sanitizeTitle(title) {
    return title.trim().replace(/[^a-zA-Z0-9 _-]/g, '').substring(0, 100);
}

async function todoExists(title) {
    try {
        await fs.access(path.join(MESSAGE_DIR, `${title}.json`));
        return true;
    } catch {
        return false;
    }
}

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.get('/', readLimiter, (req, res) => {
    res.sendFile(path.join(PAGE_DIR, 'message.html'));
});

app.get('/exists', readLimiter, (req, res) => {
    res.sendFile(path.join(PAGE_DIR, 'exists.html'));
});

// List all todos
app.get('/todos', readLimiter, async (req, res) => {
    try {
        const files = await fs.readdir(MESSAGE_DIR);
        const todos = await Promise.all(
            files
                .filter(f => f.endsWith('.json'))
                .map(async (file) => {
                    const filePath = path.join(MESSAGE_DIR, file);
                    try {
                        const content = await fs.readFile(filePath, 'utf-8');
                        return JSON.parse(content);
                    } catch {
                        return null;
                    }
                })
        );
        const sorted = todos
            .filter(Boolean)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(sorted);
    } catch (error) {
        console.error('Error fetching todos:', error);
        res.status(500).json({ error: 'Failed to fetch todos' });
    }
});

// Create a todo
app.post('/create', writeLimiter, async (req, res) => {
    const rawTitle = req.body.title || '';
    const text = (req.body.text || '').trim().substring(0, 500);
    const isJson = req.headers['content-type'] && req.headers['content-type'].includes('application/json');

    if (!rawTitle.trim()) {
        return isJson
            ? res.status(400).json({ error: 'Title is required' })
            : res.redirect('/exists?reason=empty');
    }

    const title = sanitizeTitle(rawTitle);
    if (!title) {
        return isJson
            ? res.status(400).json({ error: 'Title contains only invalid characters' })
            : res.redirect('/exists?reason=invalid');
    }

    const finalFilePath = path.join(MESSAGE_DIR, `${title}.json`);
    const tempFilePath = path.join(TEMP_DIR, `${title}.json`);

    try {
        const todo = { title, text, completed: false, createdAt: new Date().toISOString() };
        await fs.writeFile(tempFilePath, JSON.stringify(todo, null, 2));

        if (await todoExists(title)) {
            await fs.unlink(tempFilePath).catch(() => {});
            return isJson
                ? res.status(409).json({ error: 'A todo with this title already exists' })
                : res.redirect('/exists');
        }

        await fs.rename(tempFilePath, finalFilePath);
        return isJson ? res.status(201).json(todo) : res.redirect('/');
    } catch (error) {
        console.error('Error creating todo:', error);
        await fs.unlink(tempFilePath).catch(() => {});
        return isJson
            ? res.status(500).json({ error: 'Internal Server Error' })
            : res.status(500).send('Internal Server Error');
    }
});

// Update a todo (toggle completed or change description)
app.put('/todos/:title', writeLimiter, async (req, res) => {
    const title = sanitizeTitle(req.params.title);
    if (!title) return res.status(400).json({ error: 'Invalid title' });

    const filePath = path.join(MESSAGE_DIR, `${title}.json`);
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const todo = JSON.parse(content);

        if (typeof req.body.completed === 'boolean') todo.completed = req.body.completed;
        if (typeof req.body.text === 'string') todo.text = req.body.text.trim().substring(0, 500);

        await fs.writeFile(filePath, JSON.stringify(todo, null, 2));
        res.json(todo);
    } catch (error) {
        if (error.code === 'ENOENT') return res.status(404).json({ error: 'Todo not found' });
        console.error('Error updating todo:', error);
        res.status(500).json({ error: 'Failed to update todo' });
    }
});

// Delete a todo
app.delete('/todos/:title', writeLimiter, async (req, res) => {
    const title = sanitizeTitle(req.params.title);
    if (!title) return res.status(400).json({ error: 'Invalid title' });

    try {
        await fs.unlink(path.join(MESSAGE_DIR, `${title}.json`));
        res.json({ message: 'Todo deleted successfully' });
    } catch (error) {
        if (error.code === 'ENOENT') return res.status(404).json({ error: 'Todo not found' });
        console.error('Error deleting todo:', error);
        res.status(500).json({ error: 'Failed to delete todo' });
    }
});

ensureDirectories()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Failed to initialize directories:', err);
        process.exit(1);
    });
