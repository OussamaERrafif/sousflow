# backend

A FastAPI project

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- pip

### Installation

1. Clone the repository or extract the ZIP file

2. Create a virtual environment:
```bash
python -m venv venv
```

3. Activate the virtual environment:
```bash
# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

4. Install dependencies:
```bash
pip install -r requirements.txt
```

5. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

6. Configure your database connection in `.env`

### Using Docker

```bash
docker-compose up --build
```

### Run the application

```bash
python main.py
```

Or with uvicorn:
```bash
uvicorn main:app --reload
```

The API will be available at: `http://localhost:8000`

- **API Documentation**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 📁 Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── api.py          # API routes
│   └── schemas.py      # Pydantic schemas
│   ├── database.py     # Database connection
│   └── auth.py         # Authentication
├── main.py
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## 🔧 Configuration

Edit `.env` file to configure:

- Database connection
- JWT secret key

## 🧪 Testing

Run tests:
```bash
pytest
```

With coverage:
```bash
pytest --cov=app tests/
```

## 📚 Features

- ✅ JWT authentication
- ✅ Docker support
- ✅ Auto-generated API docs
- ✅ Pydantic validation

## 📝 API Endpoints

- `GET /` - Root endpoint
- `GET /health` - Health check
- `GET /docs` - Swagger UI documentation
- `GET /redoc` - ReDoc documentation

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

MIT

---

**Generated with ❤️ by FastAPI Project Generator**